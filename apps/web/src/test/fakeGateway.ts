import { vi } from "vitest";
import type {
  Gateway,
  GatewayEventHandler,
  GatewayEventPayload,
  GatewayServerRequestHandler,
  Unsubscribe,
} from "../api/ws";

export interface RecordedRequest {
  method: string;
  params: GatewayEventPayload;
}

export interface RecordedServerRequest {
  method: string;
  params: GatewayEventPayload;
  respond: (result: GatewayEventPayload) => void;
}

/**
 * 可注入的假网关：记录请求、可主动触发事件与服务端请求，绝不连网络。
 */
export class FakeGateway implements Gateway {
  readonly requests: RecordedRequest[] = [];
  readonly serverRequests: RecordedServerRequest[] = [];
  connected = false;

  private readonly handlers = new Map<string, Set<GatewayEventHandler>>();
  private readonly serverHandlers = new Map<string, Set<GatewayServerRequestHandler>>();

  constructor(
    private readonly impl: (
      method: string,
      params: GatewayEventPayload,
    ) => unknown | Promise<unknown> = () => ({}),
  ) {}

  connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  close(): void {
    this.connected = false;
  }

  request<T = unknown>(method: string, params: GatewayEventPayload = {}): Promise<T> {
    this.requests.push({ method, params });
    const result = this.impl(method, params);
    // 仅当测试 handler 未给出非空结果时，才补默认应答（session.resume/create）。
    if (isEmptyResult(result)) {
      const fallback = defaultReply(method, params);
      if (fallback !== undefined) {
        return Promise.resolve(fallback as T);
      }
    }
    return Promise.resolve(result as T);
  }

  on(type: string, handler: GatewayEventHandler): Unsubscribe {
    const set = this.handlers.get(type) ?? new Set<GatewayEventHandler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  onServerRequest(method: string, handler: GatewayServerRequestHandler): Unsubscribe {
    const set = this.serverHandlers.get(method) ?? new Set<GatewayServerRequestHandler>();
    set.add(handler);
    this.serverHandlers.set(method, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.serverHandlers.delete(method);
      }
    };
  }

  /** 便于断言：某事件类型当前存活的 handler 数量。 */
  subscriberCount(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  /** 触发一个 server→client 事件。 */
  emit(type: string, payload: GatewayEventPayload = {}): void {
    for (const handler of this.handlers.get(type) ?? []) {
      handler(payload);
    }
  }

  /** 触发一个 server→client 请求，返回回包 spy。 */
  emitServerRequest(
    method: string,
    params: GatewayEventPayload = {},
  ): ReturnType<typeof vi.fn<(result: GatewayEventPayload) => void>> {
    const respond = vi.fn<(result: GatewayEventPayload) => void>();
    this.serverRequests.push({ method, params, respond });
    for (const handler of this.serverHandlers.get(method) ?? []) {
      handler(params, respond);
    }
    return respond;
  }

  /** 便于断言：某方法的所有调用参数。 */
  paramsOf(method: string): GatewayEventPayload[] {
    return this.requests.filter((entry) => entry.method === method).map((entry) => entry.params);
  }
}

/** 空结果判定：null/undefined / 空数组 / 无非空自有键的对象（Promise 不算空）。 */
function isEmptyResult(result: unknown): boolean {
  if (result == null) {
    return true;
  }
  if (typeof (result as { then?: unknown }).then === "function") {
    return false;
  }
  if (Array.isArray(result)) {
    return result.length === 0;
  }
  if (typeof result === "object") {
    return Object.keys(result as object).length === 0;
  }
  return false;
}

/** 会话身份 RPC 的默认应答：刻意 R≠S 以捕获 fail-open（客户端不得用 stored 当 runtime）。 */
function defaultReply(
  method: string,
  params: GatewayEventPayload,
): GatewayEventPayload | undefined {
  if (method === "session.resume") {
    return { session_id: "runtime:" + String(params.session_id) };
  }
  if (method === "session.create") {
    return { session_id: "runtime:new", stored_session_id: "stored:new" };
  }
  return undefined;
}

export function createFakeGateway(
  impl?: (method: string, params: GatewayEventPayload) => unknown | Promise<unknown>,
): FakeGateway {
  return new FakeGateway(impl);
}
