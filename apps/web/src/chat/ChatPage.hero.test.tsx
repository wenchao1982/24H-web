import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPage from "./ChatPage";
import { GatewayProvider } from "./GatewayProvider";
import { SessionProvider, type SessionUser } from "../auth/SessionProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";

const ADMIN: SessionUser = {
  id: 1,
  username: "admin",
  role: "admin",
  must_change_password: false,
  profiles: ["alpha", "beta"],
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

function renderHero(
  gateway: FakeGateway,
  initialUser: SessionUser | null = ADMIN,
) {
  const page = (
    <GatewayProvider gateway={gateway}>
      <ChatPage />
    </GatewayProvider>
  );
  return render(
    initialUser ? <SessionProvider initialUser={initialUser}>{page}</SessionProvider> : page,
  );
}

function list() {
  return within(screen.getByRole("complementary"));
}

function composer(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector("form.composer");
  if (!form) {
    throw new Error("缺少 Composer");
  }
  return form as HTMLFormElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatPage hero 双态（REQ-001 / REQ-014）", () => {
  it("hero 与 docked 互斥：空态渲染 hero，发送后切 docked", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method) => (method === "session.list" ? { sessions: [] } : {}));
    const { container } = renderHero(gateway);
    const user = userEvent.setup();

    expect(container.querySelector(".chat-hero")).not.toBeNull();
    expect(composer(container)).toHaveAttribute("data-variant", "hero");

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(container.querySelector(".chat-hero")).toBeNull());
    expect(composer(container)).toHaveAttribute("data-variant", "docked");
  });

  it("hero 态有文本即可发送（REQ-014 不因身份未就绪而禁用）", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method) => (method === "session.list" ? { sessions: [] } : {}));
    renderHero(gateway);
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();

    await user.type(screen.getByLabelText("消息"), "首条消息");
    expect(screen.getByRole("button", { name: "发送" })).toBeEnabled();
  });
});

describe("ChatPage hero 发送编排（REQ-006）", () => {
  it("按 create → attach* → submit 顺序执行，attach 用 runtime id", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method) => (method === "session.list" ? { sessions: [] } : {}));
    renderHero(gateway);
    const user = userEvent.setup();

    await user.upload(
      screen.getByLabelText("文件"),
      new File(["hello"], "notes.txt", { type: "text/plain" }),
    );
    await user.type(screen.getByLabelText("消息"), "带你一起");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(gateway.paramsOf("prompt.submit")).toHaveLength(1));
    const methods = gateway.requests.map((entry) => entry.method);
    expect(methods.indexOf("session.create")).toBeLessThan(methods.indexOf("file.attach"));
    expect(methods.indexOf("file.attach")).toBeLessThan(methods.indexOf("prompt.submit"));

    const create = gateway.paramsOf("session.create")[0];
    // 未显式选择智能体时不注入 profile（由 BFF 按 REQ-017 注入 default_profile）。
    expect(create).not.toHaveProperty("profile");
    expect(gateway.paramsOf("file.attach")[0]).toMatchObject({ name: "notes.txt" });
    expect(gateway.paramsOf("prompt.submit")[0]).toEqual({
      text: "带你一起",
      session_id: "runtime:new",
    });
  });

  it("single-flight：hero 并发双击只产生一次 session.create", async () => {
    stubWorkspaces();
    let resolveCreate: ((value: unknown) => void) | undefined;
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [] };
      }
      if (method === "session.create") {
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      }
      return {};
    });
    renderHero(gateway);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("消息"), "你好");
    const send = screen.getByRole("button", { name: "发送" });
    await user.click(send);
    await user.click(send);

    expect(gateway.paramsOf("session.create")).toHaveLength(1);

    resolveCreate?.({ session_id: "runtime:new", stored_session_id: "stored:new" });
    await waitFor(() => expect(gateway.paramsOf("prompt.submit")).toHaveLength(1));
    expect(gateway.paramsOf("session.create")).toHaveLength(1);
  });

  it("超 10MB 文件被拒且不读取内容、不产生 RPC", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method) => (method === "session.list" ? { sessions: [] } : {}));
    renderHero(gateway);
    const user = userEvent.setup();

    const big = new File(["x"], "big.bin", { type: "application/octet-stream" });
    Object.defineProperty(big, "size", { value: 12 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("文件"), big);

    expect(await screen.findByText(/10MB/)).toBeInTheDocument();
    expect(screen.queryByText("big.bin")).not.toBeInTheDocument();
    const attachMethods = gateway.requests.filter((entry) =>
      entry.method.startsWith("file.attach") ||
      entry.method.startsWith("image.attach") ||
      entry.method.startsWith("pdf.attach"),
    );
    expect(attachMethods).toHaveLength(0);
    expect(gateway.paramsOf("session.create")).toHaveLength(0);
  });

  it("create 失败保持 hero 并还原草稿/附件", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [] };
      }
      if (method === "session.create") {
        throw new Error("创建失败");
      }
      return {};
    });
    const { container } = renderHero(gateway);
    const user = userEvent.setup();

    await user.upload(
      screen.getByLabelText("文件"),
      new File(["hello"], "notes.txt", { type: "text/plain" }),
    );
    await user.type(screen.getByLabelText("消息"), "保留我");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("创建失败")).toBeInTheDocument();
    expect(container.querySelector(".chat-hero")).not.toBeNull();
    expect(screen.getByLabelText("消息")).toHaveValue("保留我");
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(gateway.paramsOf("prompt.submit")).toHaveLength(0);
  });
});

describe("ChatPage REQ-020 显式 profile 随会话域 RPC", () => {
  it("选择智能体后 session.resume 携带 params.profile", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method, params) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "model.options") {
        return params.profile ? CATALOG : CATALOG;
      }
      return {};
    });
    renderHero(gateway);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByRole("combobox", { name: "智能体" }), "beta");
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await waitFor(() =>
      expect(gateway.paramsOf("session.resume")).toContainEqual({
        session_id: "s1",
        profile: "beta",
      }),
    );
  });

  it("未显式选择智能体时 session.list 不上送 profile（由 BFF 注入 default）", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderHero(gateway);

    await waitFor(() => expect(gateway.paramsOf("session.list")).toHaveLength(1));
    expect(gateway.paramsOf("session.list")[0]).not.toHaveProperty("profile");
  });

  it("选择智能体后 session.list 与 session.events.since 均携带 params.profile", async () => {
    stubWorkspaces();
    const gateway = createFakeGateway((method, params) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "model.options") {
        return params.profile ? CATALOG : CATALOG;
      }
      return {};
    });
    renderHero(gateway);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByRole("combobox", { name: "智能体" }), "beta");
    await waitFor(() =>
      expect(gateway.paramsOf("session.list")).toContainEqual({
        profile: "beta",
      }),
    );

    await user.click(await list().findByRole("button", { name: "会话一" }));
    await waitFor(() =>
      expect(gateway.paramsOf("session.events.since")).toContainEqual({
        session_id: "runtime:s1",
        profile: "beta",
      }),
    );
  });
});
