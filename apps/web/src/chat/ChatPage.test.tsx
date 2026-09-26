import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPage from "./ChatPage";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";

const SESSIONS = {
  sessions: [
    { id: "s1", title: "第一会话" },
    { id: "s2", title: "部署排查" },
  ],
};

function renderChat(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <ChatPage />
    </GatewayProvider>,
  );
}

describe("ChatPage T6.1 会话列表", () => {
  it("renders sessions returned by session.list", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);

    expect(await screen.findByText("第一会话")).toBeInTheDocument();
    expect(screen.getByText("部署排查")).toBeInTheDocument();
  });

  it("filters sessions by title", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);
    await screen.findByText("第一会话");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("会话搜索"), "部署");

    expect(screen.queryByText("第一会话")).not.toBeInTheDocument();
    expect(screen.getByText("部署排查")).toBeInTheDocument();
  });

  it("selects a session from the list", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);
    const item = await screen.findByRole("button", { name: "第一会话" });

    const user = userEvent.setup();
    await user.click(item);

    expect(screen.getByRole("button", { name: "第一会话" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("heading", { name: "第一会话" })).toBeInTheDocument();
  });
});

describe("ChatPage T6.2 新建会话", () => {
  it("calls session.create and selects the new session", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return SESSIONS;
      }
      if (method === "session.create") {
        return { session_id: "s3" };
      }
      return {};
    });
    renderChat(gateway);
    await screen.findByText("第一会话");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建会话" }));

    expect(gateway.paramsOf("session.create")).toHaveLength(1);
    expect(await screen.findByRole("heading", { name: "新会话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新会话" })).toHaveAttribute("data-active", "true");
  });
});

describe("ChatPage T6.3 流式消息", () => {
  it("sends a prompt optimistically and accumulates assistant deltas", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(gateway.paramsOf("prompt.submit")).toEqual([{ session_id: "s1", text: "你好" }]);

    act(() => {
      gateway.emit("message.delta", { session_id: "s1", text: "收到" });
      gateway.emit("message.delta", { session_id: "s1", text: "了" });
    });
    expect(screen.getByText("收到了")).toBeInTheDocument();

    act(() => {
      gateway.emit("message.complete", { session_id: "s1", text: "收到了，请稍等。" });
    });
    expect(screen.getByText("收到了，请稍等。")).toBeInTheDocument();
  });
});

describe("ChatPage T6.4 工具卡", () => {
  it("renders tool cards across start/generating/complete", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "会话一" }));

    act(() => {
      gateway.emit("tool.start", { session_id: "s1", id: "t1", name: "web_search" });
    });
    expect(screen.getByText("web_search")).toBeInTheDocument();
    expect(screen.getByText("已开始")).toBeInTheDocument();

    act(() => {
      gateway.emit("tool.generating", {
        session_id: "s1",
        id: "t1",
        name: "web_search",
        detail: "正在搜索",
      });
    });
    expect(screen.getByText("生成中")).toBeInTheDocument();
    expect(screen.getByText("正在搜索")).toBeInTheDocument();

    act(() => {
      gateway.emit("tool.complete", {
        session_id: "s1",
        id: "t1",
        name: "web_search",
        result: "3 条结果",
      });
    });
    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.getByText("3 条结果")).toBeInTheDocument();
  });
});

describe("ChatPage T6.5 审批/澄清", () => {
  it("renders an approval card and replies with the chosen option", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "会话一" }));

    let respond!: ReturnType<typeof gateway.emitServerRequest>;
    act(() => {
      respond = gateway.emitServerRequest("approval", {
        prompt: "是否允许执行该命令？",
        options: ["once", "deny"],
      });
    });

    expect(screen.getByText("是否允许执行该命令？")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "允许一次" }));

    expect(respond).toHaveBeenCalledWith({ choice: "once" });
    expect(screen.getByText(/已回复/)).toBeInTheDocument();
  });

  it("renders a clarify card and replies with the chosen answer", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "会话一" }));

    let respond!: ReturnType<typeof gateway.emitServerRequest>;
    act(() => {
      respond = gateway.emitServerRequest("clarify", {
        question: "选择哪个环境？",
        options: [{ value: "staging", label: "预发" }, "production"],
      });
    });

    await user.click(screen.getByRole("button", { name: "预发" }));
    expect(respond).toHaveBeenCalledWith({ answer: "staging" });
  });
});

describe("ChatPage T6.6 其它服务端请求", () => {
  it("answers a secret request with the provided value", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "会话一" }));

    let respond!: ReturnType<typeof gateway.emitServerRequest>;
    act(() => {
      respond = gateway.emitServerRequest("secret", { prompt: "请输入 API Token" });
    });

    expect(screen.getByText("需要密钥")).toBeInTheDocument();
    await user.type(screen.getByLabelText("需要密钥输入"), "sk-123");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(respond).toHaveBeenCalledWith({ value: "sk-123" });
  });
});
