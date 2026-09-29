import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPage from "./ChatPage";
import { GatewayProvider } from "./GatewayProvider";
import { GatewayClient } from "../api/ws";

/**
 * 端到端回归：真实的 `GatewayClient` 派发路径 → `ChatPage` 渲染。
 *
 * 背景（此前遗漏的 bug）：Hermes 的事件帧把 runtime `session_id` 放在 `params.session_id`，
 * 而正文在 `params.payload`。`GatewayClient.dispatch` 必须把两者合并后再交给 handler，
 * 否则 `matchesRuntime` 判空 → 助手回复永不渲染。本测试用真实 socket 帧守护该合并。
 */

const STORED_ID = "20260928_102322_7f04bb";
const RUNTIME_ID = "rt-0a37b493";

interface ParsedFrame {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
}

interface SentRequest {
  method: string;
  params: Record<string, unknown>;
}

/** Controllable stand-in for the browser WebSocket, never touches the network. */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();
  private queued: string[] = [];

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
    if (type === "message" && this.queued.length > 0) {
      const pending = this.queued;
      this.queued = [];
      for (const data of pending) {
        listener({ data });
      }
    }
  }

  send(data: string): void {
    this.sent.push(data);
    this.autoRespond(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open", {});
  }

  receive(data: string): void {
    if ((this.listeners.get("message")?.size ?? 0) === 0) {
      this.queued.push(data);
      return;
    }
    this.emit("message", { data });
  }

  private emit(type: string, event: { data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  /** 最小自动应答器：解析客户端 JSON-RPC 请求，回以真实 Hermes 形状的 result。 */
  private autoRespond(raw: string): void {
    let frame: ParsedFrame;
    try {
      frame = JSON.parse(raw) as ParsedFrame;
    } catch {
      return;
    }
    if (typeof frame.id !== "number" || typeof frame.method !== "string") {
      return;
    }
    let result: unknown = {};
    switch (frame.method) {
      case "session.list":
        result = { sessions: [{ id: STORED_ID, title: "历史会话" }] };
        break;
      case "session.resume":
        result = { session_id: RUNTIME_ID, resumed: STORED_ID };
        break;
      case "commands.catalog":
        result = { commands: [] };
        break;
      case "session.events.since":
        result = { requests: [] };
        break;
      case "prompt.submit":
        result = {};
        break;
      default:
        result = {};
    }
    const reply = JSON.stringify({ jsonrpc: "2.0", id: frame.id, result });
    // 真实 socket 的应答总是异步到达；同步回调会早于 request() 登记 pending resolver。
    queueMicrotask(() => this.receive(reply));
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

function sentRequests(socket: FakeWebSocket): SentRequest[] {
  return socket.sent.flatMap((raw) => {
    const frame = JSON.parse(raw) as ParsedFrame;
    if (typeof frame.method !== "string") {
      return [];
    }
    return [{ method: frame.method, params: frame.params ?? {} }];
  });
}

function activeSocket(sockets: FakeWebSocket[]): FakeWebSocket {
  const socket = sockets[sockets.length - 1];
  if (!socket) {
    throw new Error("没有创建 WebSocket");
  }
  return socket;
}

async function renderAndOpen(gateway: GatewayClient, sockets: FakeWebSocket[]): Promise<void> {
  render(
    <GatewayProvider gateway={gateway}>
      <ChatPage />
    </GatewayProvider>,
  );
  await act(async () => {
    for (const socket of sockets) {
      socket.open();
    }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatPage 集成：真实 GatewayClient 事件派发", () => {
  it("renders an assistant reply delivered as Hermes event frames with params.session_id", async () => {
    const sockets = stubWebSocket();
    await renderAndOpen(new GatewayClient(), sockets);
    const socket = activeSocket(sockets);
    const user = userEvent.setup();

    // 1. 会话列表渲染后点选会话
    await user.click(
      await within(screen.getByRole("complementary")).findByRole("button", {
        name: "历史会话",
      }),
    );

    // 2. session.resume 用持久化 stored id 发出
    await waitFor(() => {
      expect(
        sentRequests(socket).some(
          (entry) => entry.method === "session.resume" && entry.params.session_id === STORED_ID,
        ),
      ).toBe(true);
    });

    // 3. 发送消息：prompt.submit 必须携带 resume 返回的 runtime id（刻意不同于 stored id）
    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(
        sentRequests(socket).some(
          (entry) => entry.method === "prompt.submit" && entry.params.session_id === RUNTIME_ID,
        ),
      ).toBe(true);
    });

    // 4. 喂入真实 Hermes 形状的事件帧：session_id 放在 params（而非 payload）里
    act(() => {
      socket.receive(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "event",
          params: {
            type: "message.delta",
            session_id: RUNTIME_ID,
            payload: { text: "您好" },
          },
        }),
      );
      socket.receive(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "event",
          params: {
            type: "message.complete",
            session_id: RUNTIME_ID,
            payload: { text: "您好，请稍等。" },
          },
        }),
      );
    });

    // 5. 助手回复必须渲染进 DOM
    expect(await screen.findByText("您好，请稍等。")).toBeInTheDocument();
  });

  it("ignores event frames whose params.session_id is a different runtime id", async () => {
    const sockets = stubWebSocket();
    await renderAndOpen(new GatewayClient(), sockets);
    const socket = activeSocket(sockets);
    const user = userEvent.setup();

    await user.click(
      await within(screen.getByRole("complementary")).findByRole("button", {
        name: "历史会话",
      }),
    );
    await waitFor(() => {
      expect(
        sentRequests(socket).some((entry) => entry.method === "session.resume"),
      ).toBe(true);
    });

    act(() => {
      socket.receive(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "event",
          params: {
            type: "message.delta",
            session_id: "rt-other",
            payload: { text: "不应出现" },
          },
        }),
      );
    });

    expect(screen.queryByText("不应出现")).not.toBeInTheDocument();
  });
});
