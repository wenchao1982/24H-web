import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPage from "./ChatPage";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";

const SESSION_ID = "s1";
const RUNTIME_ID = "runtime:s1";

/**
 * 严格模式重复助手气泡回归（调查用）。
 *
 * 假设：`ChatPage` 的事件注册 effect 没有 cleanup，`Gateway` 也没有 `off`。
 * React StrictMode 在开发环境会 mount → unmount → mount 双跑 effect，
 * 于是同一个 `message.complete` 事件会被两个 handler 各处理一次：
 * 第一次封口流式气泡，第二次因为末尾已非 streaming 而**追加一个重复气泡**。
 */

function renderChat(gateway: FakeGateway, strict: boolean) {
  const page = (
    <GatewayProvider gateway={gateway}>
      <ChatPage />
    </GatewayProvider>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

interface Scenario {
  registrations: number;
  assistantBubbles: Element[];
  texts: string[];
}

async function runScenario(strict: boolean): Promise<Scenario> {
  const gateway = createFakeGateway((method) => {
    if (method === "session.list") {
      return { sessions: [{ id: SESSION_ID, title: "会话一" }] };
    }
    if (method === "commands.catalog") {
      return { commands: [] };
    }
    return {};
  });

  const { container } = renderChat(gateway, strict);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "会话一" }));

  act(() => {
    gateway.emit("message.delta", { session_id: RUNTIME_ID, text: "你好" });
    gateway.emit("message.complete", { session_id: RUNTIME_ID, text: "你好，世界" });
  });

  // StrictMode 会 mount → unmount → mount 双跑 effect，`on()` 调用次数必然为 2；
  // 真正的不变量是 cleanup 后**存活**的 message.complete handler 恰好一个。
  const registrations = gateway.subscriberCount("message.complete");
  const assistantBubbles = Array.from(
    container.querySelectorAll('.bubble[data-role="assistant"]'),
  );
  const texts = assistantBubbles.map((node) => node.textContent ?? "");
  return { registrations, assistantBubbles, texts };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatPage StrictMode 重复助手气泡调查", () => {
  it("对照组（无 StrictMode）：每个事件只注册一次，恰好一个助手气泡", async () => {
    const { registrations, assistantBubbles, texts } = await runScenario(false);

    expect(registrations, "非 StrictMode 下 message.complete 注册次数").toBe(1);
    expect(assistantBubbles, "非 StrictMode 下助手气泡数量").toHaveLength(1);
    expect(texts).toEqual(["你好，世界"]);
  });

  it("StrictMode：一个 message.complete 事件只应产生一个助手气泡", async () => {
    const { registrations, assistantBubbles, texts } = await runScenario(true);

    expect.soft(registrations, "StrictMode 下 message.complete 注册次数").toBe(1);
    expect.soft(assistantBubbles, `StrictMode 下助手气泡数量（文本=${texts.join(" | ")}）`).toHaveLength(
      1,
    );
    expect.soft(texts, `StrictMode 下助手气泡文本（文本=${texts.join(" | ")}）`).toEqual([
      "你好，世界",
    ]);
  });
});
