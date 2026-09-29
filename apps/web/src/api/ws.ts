export type GatewayEventPayload = Record<string, unknown>;

export type GatewayEventHandler = (payload: GatewayEventPayload) => void;

export type GatewayServerRequestHandler = (
  params: GatewayEventPayload,
  respond: (result: GatewayEventPayload) => void,
) => void;

/** 退订函数：调用后移除对应的 handler（StrictMode/切页时释放订阅）。 */
export type Unsubscribe = () => void;

/**
 * L1 网关客户端抽象。ChatPage 只依赖本接口，测试注入 fake gateway，绝不连网络。
 */
export interface Gateway {
  connect(url?: string): Promise<void>;
  request<T = unknown>(method: string, params?: GatewayEventPayload): Promise<T>;
  on(type: string, handler: GatewayEventHandler): Unsubscribe;
  onServerRequest(method: string, handler: GatewayServerRequestHandler): Unsubscribe;
  close(): void;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

/** 会话不在内存（需重新 resume）：错误码 4001，或消息含 "session not found"。 */
export function isSessionNotFound(error: unknown): boolean {
  if ((error as { code?: number } | null)?.code === 4001) {
    return true;
  }
  return /session not found/i.test(String((error as Error)?.message ?? error));
}

/** 由页面 origin 推导 `/api/hermes/ws` 的 WebSocket 地址（http→ws，https→wss）。 */
export function wsUrl(origin: string, basePath = ""): string {
  const base = basePath.replace(/\/$/, "");
  const url = new URL(`${base}/api/hermes/ws`, origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/**
 * `/api/hermes/ws` 的 JSON-RPC 客户端（经 BFF 代理到 Hermes L1 网关）。
 * 同源 cookie 自动随握手发送，无需注入 token。
 */
export class GatewayClient implements Gateway {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly outbox: string[] = [];
  private readonly handlers = new Map<string, Set<GatewayEventHandler>>();
  private readonly serverRequests = new Map<string, Set<GatewayServerRequestHandler>>();
  private connectPromise: Promise<void> | null = null;

  connect(url: string = wsUrl(location.origin)): Promise<void> {
    if (typeof WebSocket === "undefined") {
      return Promise.reject(new Error("当前环境不支持 WebSocket"));
    }
    // 幂等：已有进行中/已成功的连接时复用同一 Promise，避免重复建 socket。
    if (this.connectPromise) {
      return this.connectPromise;
    }
    const ws = new WebSocket(url);
    this.ws = ws;
    const promise = new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("WebSocket 连接失败")), {
        once: true,
      });
    }).then(() => {
      ws.addEventListener("message", (event) => this.dispatch(String(event.data)));
      // Flush requests issued while the socket was still connecting.
      for (const frame of this.outbox.splice(0)) {
        ws.send(frame);
      }
    });
    // 失败时清空，允许后续重连；成功则保留供复用。
    this.connectPromise = promise.catch((error: unknown) => {
      this.connectPromise = null;
      throw error;
    });
    return this.connectPromise;
  }

  private dispatch(raw: string): void {
    let frame: {
      id?: number | string;
      method?: string;
      result?: unknown;
      error?: { message?: string; code?: number; data?: { code?: unknown } };
      params?: {
        type?: string;
        payload?: Record<string, unknown>;
        session_id?: string;
        sessionId?: string;
      };
    };
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    // 我方请求的响应
    if (frame.id != null && frame.method === undefined && typeof frame.id === "number") {
      const pending = this.pending.get(frame.id);
      if (pending) {
        this.pending.delete(frame.id);
        if (frame.error) {
          const err = new Error(String(frame.error.message ?? frame.error)) as Error & {
            code?: number | string;
          };
          // 命名错误码（如 PROFILE_FORBIDDEN，见 BFF profileForbiddenFrame）优先；
          // 无命名码时保持既有数字 frame.error.code 行为。
          const namedCode = frame.error.data?.code;
          if (typeof namedCode === "string" && namedCode !== "") {
            err.code = namedCode;
          } else if (typeof frame.error.code === "number") {
            err.code = frame.error.code;
          }
          pending.reject(err);
        } else {
          pending.resolve(frame.result);
        }
      }
      return;
    }

    // 通知（事件）
    if (frame.method === "event") {
      const type = frame.params?.type;
      if (type) {
        const raw = frame.params?.payload;
        const payload: Record<string, unknown> = {
          ...(raw && typeof raw === "object" ? raw : {}),
        };
        const sid = frame.params?.session_id ?? frame.params?.sessionId;
        if (typeof sid === "string" && payload.session_id === undefined) {
          payload.session_id = sid;
        }
        for (const handler of this.handlers.get(type) ?? []) {
          handler(payload);
        }
      }
      return;
    }

    // 服务端 → 客户端请求：必须回包，否则 turn 卡住（多订阅者只回一次）
    if (frame.id != null && frame.method) {
      let responded = false;
      const respond = (result: Record<string, unknown>) => {
        if (responded) {
          return;
        }
        responded = true;
        this.ws?.send(JSON.stringify({ jsonrpc: "2.0", id: frame.id, result }));
      };
      const handlers = this.serverRequests.get(frame.method);
      if (handlers && handlers.size > 0) {
        for (const handler of handlers) {
          handler(frame.params ?? {}, respond);
        }
      } else {
        respond({});
      }
    }
  }

  request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const ws = this.ws;
    if (!ws) {
      return Promise.reject(new Error("gateway 未连接"));
    }
    const id = this.nextId++;
    const frame = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(frame);
    } else if (ws.readyState === WebSocket.CONNECTING) {
      // Queue until connect() resolves so early requests are never lost.
      this.outbox.push(frame);
    } else {
      return Promise.reject(new Error("gateway 未连接"));
    }
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    });
  }

  on(type: string, handler: GatewayEventHandler): Unsubscribe {
    const set = this.handlers.get(type) ?? new Set<GatewayEventHandler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      const current = this.handlers.get(type);
      if (!current) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  onServerRequest(method: string, handler: GatewayServerRequestHandler): Unsubscribe {
    const set = this.serverRequests.get(method) ?? new Set<GatewayServerRequestHandler>();
    set.add(handler);
    this.serverRequests.set(method, set);
    return () => {
      const current = this.serverRequests.get(method);
      if (!current) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        this.serverRequests.delete(method);
      }
    };
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.connectPromise = null;
  }
}

/** 生产用工厂；测试请改用 `@/test/fakeGateway`。 */
export function createGateway(): Gateway {
  return new GatewayClient();
}
