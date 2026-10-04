import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPage from "./ChatPage";
import { GatewayProvider } from "./GatewayProvider";
import { SessionProvider, type SessionUser } from "../auth/SessionProvider";
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
  await user.click(
    await within(screen.getByRole("complementary")).findByRole("button", { name: "会话一" }),
  );

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
    // M19：助手气泡含「朗读」按钮，故断言包含消息文本而非全等。
    expect(texts[0]).toContain("你好，世界");
  });

  it("StrictMode：一个 message.complete 事件只应产生一个助手气泡", async () => {
    const { registrations, assistantBubbles, texts } = await runScenario(true);

    expect.soft(registrations, "StrictMode 下 message.complete 注册次数").toBe(1);
    expect.soft(assistantBubbles, `StrictMode 下助手气泡数量（文本=${texts.join(" | ")}）`).toHaveLength(
      1,
    );
    expect.soft(texts[0], `StrictMode 下助手气泡文本（文本=${texts.join(" | ")}）`).toContain(
      "你好，世界",
    );
  });
});

const ADMIN: SessionUser = {
  id: 1,
  username: "admin",
  role: "admin",
  must_change_password: false,
  profiles: ["alpha"],
  default_profile: "alpha",
};

const CATALOG = {
  model: "m1",
  provider: "p",
  providers: [{ slug: "p", models: [{ id: "m1", label: "Model 1" }] }],
};

function stubWorkspaces() {
  const mock = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ workspaces: [] }),
      }) as Response,
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("ChatPage StrictMode hero/docked 与附件幂等（REQ-001 / REQ-005 / REQ-006）", () => {
  it("hero→docked 切换不丢草稿（同一 Composer 实例）", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: SESSION_ID, title: "会话一" }] } : {},
    );
    render(
      <StrictMode>
        <GatewayProvider gateway={gateway}>
          <ChatPage />
        </GatewayProvider>
      </StrictMode>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("消息"), "草稿不丢");
    await user.click(
      await within(screen.getByRole("complementary")).findByRole("button", { name: "会话一" }),
    );

    expect(screen.getByLabelText("消息")).toHaveValue("草稿不丢");
  });

  it("StrictMode 下同一附件只入 chip 一次（去重幂等）", async () => {
    stubWorkspaces();
    render(
      <StrictMode>
        <SessionProvider initialUser={ADMIN}>
          <GatewayProvider gateway={createFakeGateway((method) => (method === "session.list" ? { sessions: [] } : {}))}>
            <ChatPage />
          </GatewayProvider>
        </SessionProvider>
      </StrictMode>,
    );
    const user = userEvent.setup();
    const file = new File(["hi"], "a.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("文件"), file);
    expect(screen.getAllByText("a.txt")).toHaveLength(1);

    await user.upload(screen.getByLabelText("文件"), file);
    expect(screen.getAllByText("a.txt")).toHaveLength(1);
  });

  it("options 缓存迁移：hero→create 后 model.options 不重载", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [] };
      }
      if (method === "model.options") {
        return CATALOG;
      }
      return {};
    });
    render(
      <StrictMode>
        <SessionProvider initialUser={ADMIN}>
          <GatewayProvider gateway={gateway}>
            <ChatPage />
          </GatewayProvider>
        </SessionProvider>
      </StrictMode>,
    );
    const user = userEvent.setup();
    await waitFor(() => expect(gateway.paramsOf("model.options")).toHaveLength(1));

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(gateway.paramsOf("prompt.submit")).toHaveLength(1));

    expect(gateway.paramsOf("model.options")).toHaveLength(1);
  });
});
