import { api } from "./rest";
import { AUTH_REQUIRED, BASE, TOKEN } from "./env";

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
type EventHandler = (payload: Record<string, unknown>) => void;
type ServerRequestHandler = (
  params: Record<string, unknown>,
  respond: (result: Record<string, unknown>) => void,
) => void;

/** gated 模式：先换单次 ticket；非 gated：直接用注入的 token。 */
async function authParam(): Promise<[string, string]> {
  if (TOKEN && !AUTH_REQUIRED) return ["token", TOKEN];
  const { ticket } = await api<{ ticket: string }>("/api/auth/ws-ticket", { method: "POST" });
  return ["ticket", ticket];
}

/** L1：tui_gateway JSON-RPC over /api/ws。契约见官方 gateway-contract.generated.ts。 */
export class Gateway {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private handlers = new Map<string, EventHandler>();
  private serverRequests = new Map<string, ServerRequestHandler>();

  async connect(): Promise<void> {
    const [key, value] = await authParam();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}${BASE}/api/ws?${key}=${encodeURIComponent(value)}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("WebSocket 连接失败")), { once: true });
    });
    ws.addEventListener("message", (event) => this.dispatch(String(event.data)));
  }

  private dispatch(raw: string): void {
    let frame: {
      id?: number | string;
      method?: string;
      result?: unknown;
      error?: { message?: string };
      params?: { type?: string; payload?: Record<string, unknown> };
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
        if (frame.error) pending.reject(new Error(String(frame.error.message ?? frame.error)));
        else pending.resolve(frame.result);
      }
      return;
    }

    // 通知（事件）
    if (frame.method === "event") {
      const type = frame.params?.type;
      if (type) this.handlers.get(type)?.(frame.params?.payload ?? {});
      return;
    }

    // 服务端 → 客户端请求（approval / clarify / sudo / secret …）：必须回包
    if (frame.id != null && frame.method) {
      const respond = (result: Record<string, unknown>) =>
        this.ws?.send(JSON.stringify({ jsonrpc: "2.0", id: frame.id, result }));
      const handler = this.serverRequests.get(frame.method);
      if (handler) handler(frame.params ?? {}, respond);
      else respond({});
    }
  }

  request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.ws) return Promise.reject(new Error("gateway 未连接"));
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    });
  }

  on(type: string, handler: EventHandler): void {
    this.handlers.set(type, handler);
  }

  onServerRequest(method: string, handler: ServerRequestHandler): void {
    this.serverRequests.set(method, handler);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
