import { vi } from "vitest";
import type {
  Gateway,
  GatewayEventHandler,
  GatewayEventPayload,
  GatewayServerRequestHandler,
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

  private readonly handlers = new Map<string, GatewayEventHandler>();
  private readonly serverHandlers = new Map<string, GatewayServerRequestHandler>();

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
    return Promise.resolve(this.impl(method, params) as T);
  }

  on(type: string, handler: GatewayEventHandler): void {
    this.handlers.set(type, handler);
  }

  onServerRequest(method: string, handler: GatewayServerRequestHandler): void {
    this.serverHandlers.set(method, handler);
  }

  /** 触发一个 server→client 事件。 */
  emit(type: string, payload: GatewayEventPayload = {}): void {
    this.handlers.get(type)?.(payload);
  }

  /** 触发一个 server→client 请求，返回回包 spy。 */
  emitServerRequest(
    method: string,
    params: GatewayEventPayload = {},
  ): ReturnType<typeof vi.fn<(result: GatewayEventPayload) => void>> {
    const respond = vi.fn<(result: GatewayEventPayload) => void>();
    this.serverRequests.push({ method, params, respond });
    this.serverHandlers.get(method)?.(params, respond);
    return respond;
  }

  /** 便于断言：某方法的所有调用参数。 */
  paramsOf(method: string): GatewayEventPayload[] {
    return this.requests.filter((entry) => entry.method === method).map((entry) => entry.params);
  }
}

export function createFakeGateway(
  impl?: (method: string, params: GatewayEventPayload) => unknown | Promise<unknown>,
): FakeGateway {
  return new FakeGateway(impl);
}
