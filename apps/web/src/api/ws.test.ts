import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayClient, isSessionNotFound, wsUrl } from "./ws";

/** Controllable stand-in for the browser WebSocket, never touches the network. */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open", {});
  }

  receive(data: string): void {
    this.emit("message", { data });
  }

  private emit(type: string, event: { data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function stubWebSocket(): FakeWebSocket[] {
  const sockets: FakeWebSocket[] = [];
  vi.stubGlobal(
    "WebSocket",
    class extends FakeWebSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    },
  );
  return sockets;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wsUrl", () => {
  it("maps an http origin to ws", () => {
    expect(wsUrl("http://localhost:5173")).toBe("ws://localhost:5173/api/hermes/ws");
  });

  it("maps an https origin to wss", () => {
    expect(wsUrl("https://work.example.com")).toBe("wss://work.example.com/api/hermes/ws");
  });

  it("honours a base path", () => {
    expect(wsUrl("http://localhost:5173", "/24h")).toBe("ws://localhost:5173/24h/api/hermes/ws");
  });
});

describe("GatewayClient", () => {
  it("queues a request issued before the socket opens and delivers it after open", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();

    const connected = client.connect("ws://example.test/api/hermes/ws");
    const response = client.request("session.list", {});
    const socket = sockets[0];

    // Still connecting: nothing may be written to the socket yet.
    expect(socket.readyState).toBe(FakeWebSocket.CONNECTING);
    expect(socket.sent).toEqual([]);

    socket.open();
    await connected;

    expect(socket.sent).toEqual([
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "session.list", params: {} }),
    ]);

    socket.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { sessions: [] } }));
    await expect(response).resolves.toEqual({ sessions: [] });
  });

  it("sends immediately once the socket is already open", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();

    const connected = client.connect("ws://example.test/api/hermes/ws");
    sockets[0].open();
    await connected;

    void client.request("session.create", {});
    expect(sockets[0].sent).toEqual([
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "session.create", params: {} }),
    ]);
  });

  it("merges the sibling params.session_id into the event payload", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();
    const handler = vi.fn();
    client.on("message.delta", handler);

    const connected = client.connect("ws://example.test/api/hermes/ws");
    sockets[0].open();
    await connected;

    sockets[0].receive(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "event",
        params: { type: "message.delta", session_id: "rt-1", payload: { text: "hi" } },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ text: "hi", session_id: "rt-1" }));
  });

  it("does not overwrite a session_id already present in the payload", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();
    const handler = vi.fn();
    client.on("message.delta", handler);

    const connected = client.connect("ws://example.test/api/hermes/ws");
    sockets[0].open();
    await connected;

    sockets[0].receive(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "event",
        params: {
          type: "message.delta",
          session_id: "rt-outer",
          payload: { text: "hi", session_id: "rt-inner" },
        },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ text: "hi", session_id: "rt-inner" }),
    );
  });

  it("auto-connects and queues a request issued before any connect()", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();

    const response = client.request("session.list", {});
    // request() 自行触发连接（取代旧的「未连接即拒绝」）。
    expect(sockets).toHaveLength(1);
    expect(sockets[0].sent).toEqual([]);

    sockets[0].open();
    await Promise.resolve();

    expect(sockets[0].sent).toEqual([
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "session.list", params: {} }),
    ]);

    sockets[0].receive(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { sessions: [] } }));
    await expect(response).resolves.toEqual({ sessions: [] });
  });

  it("rejects with an Error carrying the JSON-RPC error code", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();
    const connected = client.connect("ws://example.test/api/hermes/ws");
    sockets[0].open();
    await connected;

    const pending = client.request("prompt.submit", {});
    sockets[0].receive(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 4001, message: "session not found" },
      }),
    );

    await expect(pending).rejects.toMatchObject({ code: 4001, message: "session not found" });
  });

  it("rejects with the named error.data.code when error.code is absent", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();
    const connected = client.connect("ws://example.test/api/hermes/ws");
    sockets[0].open();
    await connected;

    const pending = client.request("session.create", {});
    sockets[0].receive(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: 403,
          message: "无权访问该 profile",
          data: { code: "PROFILE_FORBIDDEN" },
        },
      }),
    );

    await expect(pending).rejects.toMatchObject({ code: "PROFILE_FORBIDDEN" });
  });

  it("falls back to the numeric error.code when error.data.code is not a string", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();
    const connected = client.connect("ws://example.test/api/hermes/ws");
    sockets[0].open();
    await connected;

    const pending = client.request("session.create", {});
    sockets[0].receive(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 403, message: "forbidden", data: { code: 123 } },
      }),
    );

    await expect(pending).rejects.toMatchObject({ code: 403 });
  });

  it("creates only one WebSocket when connect() is called twice", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();

    const first = client.connect("ws://example.test/api/hermes/ws");
    const second = client.connect("ws://example.test/api/hermes/ws");

    expect(sockets).toHaveLength(1);

    sockets[0].open();
    await Promise.all([first, second]);

    expect(sockets).toHaveLength(1);
  });

  it("stops invoking a handler once its unsubscribe is called", async () => {
    const sockets = stubWebSocket();
    const client = new GatewayClient();
    const handler = vi.fn();
    const unsubscribe = client.on("message.delta", handler);

    const connected = client.connect("ws://example.test/api/hermes/ws");
    sockets[0].open();
    await connected;

    unsubscribe();
    sockets[0].receive(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "event",
        params: { type: "message.delta", session_id: "rt-1", payload: { text: "hi" } },
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("isSessionNotFound", () => {
  it("treats a 4001 code as not found", () => {
    const error = new Error("boom") as Error & { code?: number };
    error.code = 4001;
    expect(isSessionNotFound(error)).toBe(true);
  });

  it("treats another code with a non-matching message as not not-found", () => {
    const error = new Error("boom") as Error & { code?: number };
    error.code = 500;
    expect(isSessionNotFound(error)).toBe(false);
  });

  it("falls back to the error message", () => {
    expect(isSessionNotFound(new Error("session not found"))).toBe(true);
  });
});
