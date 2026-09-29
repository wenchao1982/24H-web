export type GatewayEventPayload = Record<string, unknown>;

export type GatewayEventHandler = (payload: GatewayEventPayload) => void;

export type GatewayServerRequestHandler = (
  params: GatewayEventPayload,
  respond: (result: GatewayEventPayload) => void,
) => void;

/**
 * L1 网关客户端抽象。ChatPage 只依赖本接口，测试注入 fake gateway，绝不连网络。
 */
export interface Gateway {
  connect(url?: string): Promise<void>;
  request<T = unknown>(method: string, params?: GatewayEventPayload): Promise<T>;
  on(type: string, handler: GatewayEventHandler): void;
  onServerRequest(method: string, handler: GatewayServerRequestHandler): void;
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

  connect(url: string = wsUrl(location.origin)): Promise<void> {
    if (typeof WebSocket === "undefined") {
      return Promise.reject(new Error("当前环境不支持 WebSocket"));
    }
    const ws = new WebSocket(url);
    this.ws = ws;
    return new Promise<void>((resolve, reject) => {
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
  }

  private dispatch(raw: string): void {
    let frame: {
      id?: number | string;
      method?: string;
      result?: unknown;
      error?: { message?: string; code?: number };
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
            code?: number;
          };
          if (typeof frame.error.code === "number") {
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

  on(type: string, handler: GatewayEventHandler): void {
    const set = this.handlers.get(type) ?? new Set<GatewayEventHandler>();
    set.add(handler);
    this.handlers.set(type, set);
  }

  onServerRequest(method: string, handler: GatewayServerRequestHandler): void {
    const set = this.serverRequests.get(method) ?? new Set<GatewayServerRequestHandler>();
    set.add(handler);
    this.serverRequests.set(method, set);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

/** 生产用工厂；测试请改用 `@/test/fakeGateway`。 */
export function createGateway(): Gateway {
  return new GatewayClient();
}
