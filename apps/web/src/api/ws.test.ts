import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayClient, wsUrl } from "./ws";

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

  it("rejects a request issued before connect()", async () => {
    stubWebSocket();
    const client = new GatewayClient();
    await expect(client.request("session.list", {})).rejects.toThrow("gateway 未连接");
  });
});
