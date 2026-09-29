import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPage from "./ChatPage";
import { GatewayProvider } from "./GatewayProvider";
import { SessionProvider, type SessionUser } from "../auth/SessionProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";

/** 侧栏会话列表（hero 的「最近会话」会重复标题，查询须限定在侧栏内）。 */
function list() {
  return within(screen.getByRole("complementary"));
}

const SESSIONS = {
  sessions: [
    { id: "s1", title: "第一会话" },
    { id: "s2", title: "部署排查" },
  ],
};

const ADMIN: SessionUser = {
  id: 1,
  username: "admin",
  role: "admin",
  must_change_password: false,
  profiles: ["alpha"],
  default_profile: "alpha",
};

function renderChat(gateway: FakeGateway, initialUser: SessionUser | null = null) {
  const page = (
    <GatewayProvider gateway={gateway}>
      <ChatPage />
    </GatewayProvider>
  );
  return render(
    initialUser ? <SessionProvider initialUser={initialUser}>{page}</SessionProvider> : page,
  );
}

describe("ChatPage T6.1 会话列表", () => {
  it("renders sessions returned by session.list", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);

    expect(await list().findByText("第一会话")).toBeInTheDocument();
    expect(list().getByText("部署排查")).toBeInTheDocument();
  });

  it("filters sessions by title", async () => {
    const gateway = createFakeGateway((method, params) => {
      if (method !== "session.list") {
        return {};
      }
      if (typeof params.q === "string") {
        return { sessions: SESSIONS.sessions.filter((s) => s.title.includes(params.q as string)) };
      }
      return SESSIONS;
    });
    renderChat(gateway);
    await list().findByText("第一会话");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("会话搜索"), "部署");

    expect(list().queryByText("第一会话")).not.toBeInTheDocument();
    expect(list().getByText("部署排查")).toBeInTheDocument();
  });

  it("selects a session from the list", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);
    const item = await list().findByRole("button", { name: "第一会话" });

    const user = userEvent.setup();
    await user.click(item);

    expect(list().getByRole("button", { name: "第一会话" })).toHaveAttribute(
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
        return { session_id: "runtime:new", stored_session_id: "stored:new" };
      }
      return {};
    });
    renderChat(gateway);
    await list().findByText("第一会话");

    const user = userEvent.setup();
    await user.click(list().getByRole("button", { name: "新建" }));

    expect(gateway.paramsOf("session.create")).toHaveLength(1);
    expect(gateway.paramsOf("session.resume")).toHaveLength(0);
    expect(await screen.findByRole("heading", { name: "新会话" })).toBeInTheDocument();
    expect(list().getByRole("button", { name: "新会话" })).toHaveAttribute("data-active", "true");
  });
});

describe("ChatPage T6.3 流式消息", () => {
  it("sends a prompt optimistically and accumulates assistant deltas", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(gateway.paramsOf("prompt.submit")).toEqual([
      { session_id: "runtime:s1", text: "你好" },
    ]);

    act(() => {
      gateway.emit("message.delta", { session_id: "runtime:s1", text: "收到" });
      gateway.emit("message.delta", { session_id: "runtime:s1", text: "了" });
    });
    expect(screen.getByText("收到了")).toBeInTheDocument();

    act(() => {
      gateway.emit("message.complete", { session_id: "runtime:s1", text: "收到了，请稍等。" });
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
    await user.click(await list().findByRole("button", { name: "会话一" }));

    act(() => {
      gateway.emit("tool.start", { session_id: "runtime:s1", id: "t1", name: "web_search" });
    });
    expect(screen.getByText("web_search")).toBeInTheDocument();
    expect(screen.getByText("已开始")).toBeInTheDocument();

    act(() => {
      gateway.emit("tool.generating", {
        session_id: "runtime:s1",
        id: "t1",
        name: "web_search",
        detail: "正在搜索",
      });
    });
    expect(screen.getByText("生成中")).toBeInTheDocument();
    expect(screen.getByText("正在搜索")).toBeInTheDocument();

    act(() => {
      gateway.emit("tool.complete", {
        session_id: "runtime:s1",
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
    await user.click(await list().findByRole("button", { name: "会话一" }));

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
    await user.click(await list().findByRole("button", { name: "会话一" }));

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
    await user.click(await list().findByRole("button", { name: "会话一" }));

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

describe("ChatPage T6.7 中断", () => {
  it("turns the primary action into stop while running and interrupts", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "跑起来");
    await user.click(screen.getByRole("button", { name: "发送" }));

    const stop = screen.getByRole("button", { name: "停止" });
    expect(stop).toBeInTheDocument();
    await user.click(stop);

    expect(gateway.paramsOf("session.interrupt")).toEqual([{ session_id: "runtime:s1" }]);
    expect(await screen.findByRole("button", { name: "发送" })).toBeInTheDocument();
  });
});

describe("ChatPage T6.8 状态条", () => {
  it("renders context, tokens and rate from a thinking event", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    act(() => {
      gateway.emit("thinking", {
        session_id: "runtime:s1",
        context_percent: 18,
        tokens: 62000,
        tps: 62,
      });
    });

    const bar = screen.getByRole("status");
    expect(bar).toHaveTextContent("上下文 18%");
    expect(bar).toHaveTextContent("62k tok");
    expect(bar).toHaveTextContent("62 tok/s");
  });
});

describe("ChatPage T6.9 会话管理", () => {
  function makeGateway() {
    return createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
  }

  it("renames a session via session.title", async () => {
    const gateway = makeGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await list().findByRole("button", { name: "会话一" });

    await user.click(screen.getByRole("button", { name: "会话操作 会话一" }));
    await user.click(screen.getByRole("menuitem", { name: "重命名" }));
    const input = screen.getByLabelText("重命名 会话一");
    await user.clear(input);
    await user.type(input, "新名字");
    await user.click(screen.getByRole("button", { name: "确定" }));

    expect(gateway.paramsOf("session.title")).toEqual([
      { session_id: "runtime:s1", title: "新名字" },
    ]);
    expect(list().getByRole("button", { name: "新名字" })).toBeInTheDocument();
  });

  it("resumes a session via session.resume and selects it", async () => {
    const gateway = makeGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await list().findByRole("button", { name: "会话一" });

    await user.click(screen.getByRole("button", { name: "会话操作 会话一" }));
    await user.click(screen.getByRole("menuitem", { name: "恢复" }));

    expect(gateway.paramsOf("session.resume")).toEqual([{ session_id: "s1" }]);
    expect(list().getByRole("button", { name: "会话一" })).toHaveAttribute("data-active", "true");
  });

  it("deletes a session via session.delete", async () => {
    const gateway = makeGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await list().findByRole("button", { name: "会话一" });

    await user.click(screen.getByRole("button", { name: "会话操作 会话一" }));
    await user.click(screen.getByRole("menuitem", { name: "删除" }));
    await user.click(screen.getByRole("button", { name: "确认删除" }));

    expect(gateway.paramsOf("session.delete")).toEqual([{ session_id: "s1" }]);
    expect(list().queryByRole("button", { name: "会话一" })).not.toBeInTheDocument();
  });
});

describe("ChatPage T6.10 断线重放", () => {
  it("restores a pending server request from session.events.since", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "session.events.since") {
        return {
          pending_requests: [
            {
              request_id: "r1",
              method: "approval",
              params: { prompt: "恢复的审批", options: ["once", "deny"] },
            },
          ],
        };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    expect(await screen.findByText("恢复的审批")).toBeInTheDocument();
    expect(gateway.paramsOf("session.events.since")).toEqual([{ session_id: "runtime:s1" }]);
  });
});

describe("ChatPage T6.11 附件", () => {
  it("stages a chip with zero RPC, then attaches before submitting", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    const before = gateway.requests.length;
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("文件"), file);

    expect(await screen.findByText("notes.txt")).toBeInTheDocument();
    expect(gateway.requests.length).toBe(before);

    await user.type(screen.getByLabelText("消息"), "带你一起");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(gateway.paramsOf("file.attach")).toHaveLength(1));
    expect(gateway.paramsOf("file.attach")[0]).toMatchObject({ name: "notes.txt" });
    expect(gateway.paramsOf("prompt.submit")).toEqual([
      { text: "带你一起", session_id: "runtime:s1" },
    ]);
  });
});

describe("ChatPage T6.12 会话搜索", () => {
  it("debounces a server-side session search and shows results", async () => {
    const gateway = createFakeGateway((method, params) => {
      if (method !== "session.list") {
        return {};
      }
      if (typeof params.q === "string") {
        return { sessions: [{ id: "s9", title: "匹配结果" }] };
      }
      return { sessions: [{ id: "s1", title: "会话一" }] };
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await list().findByText("会话一");

    await user.type(screen.getByLabelText("会话搜索"), "匹配");

    await waitFor(
      () => expect(gateway.paramsOf("session.list")).toContainEqual({ q: "匹配" }),
      { timeout: 1000 },
    );
    expect(await screen.findByText("匹配结果")).toBeInTheDocument();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatPage T6.13 导入/导出/分享", () => {
  it("exports and imports sessions via the L2 proxy", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.click(screen.getByRole("button", { name: "会话操作" }));
    await user.click(screen.getByRole("menuitem", { name: "导出" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/hermes/sessions/export")),
      ).toBe(true);
    });
    const exportCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith("/api/hermes/sessions/export"),
    );
    expect((exportCall?.[1] as RequestInit).method).toBe("POST");

    await user.click(screen.getByRole("button", { name: "会话操作" }));
    await user.click(screen.getByRole("menuitem", { name: "导入" }));
    const file = new File(['{"id":"s1"}'], "s1.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("导入会话"), file);
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/hermes/sessions/import")),
      ).toBe(true);
    });
  });
});

describe("ChatPage T6.14 清理", () => {
  it("prunes and bulk-deletes via the L2 proxy", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await list().findByText("会话一");

    await user.click(screen.getByRole("button", { name: "更多" }));
    await user.click(screen.getByRole("menuitem", { name: "清理旧会话" }));
    await user.click(screen.getByRole("button", { name: "确认清理" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/hermes/sessions/prune")),
      ).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "更多" }));
    await user.click(screen.getByRole("menuitem", { name: "批量选择" }));
    await user.click(screen.getByLabelText("选择 会话一"));
    await user.click(screen.getByRole("button", { name: /批量删除/ }));
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).endsWith("/api/hermes/sessions/bulk-delete"),
        ),
      ).toBe(true);
    });
    const call = fetchMock.mock.calls.find((entry) =>
      String(entry[0]).endsWith("/api/hermes/sessions/bulk-delete"),
    );
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ ids: ["s1"] });
  });
});

describe("ChatPage T6.15 工作区", () => {
  it("lists workspaces in the hero picker and writes cwd_explicit into session.create", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) =>
        ({
          ok: true,
          status: 200,
          text: async () =>
            String(input).includes("/api/hermes/chat/workspaces")
              ? JSON.stringify({ workspaces: [{ path: "/home/u/a" }, { path: "/home/u/b" }] })
              : JSON.stringify({}),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [] } : {},
    );
    renderChat(gateway, ADMIN);
    const user = userEvent.setup();

    const select = await screen.findByLabelText("工作区");
    expect(await screen.findByRole("option", { name: "/home/u/a" })).toBeInTheDocument();

    await user.selectOptions(select, "/home/u/b");
    await user.type(screen.getByLabelText("消息"), "hi");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() =>
      expect(gateway.paramsOf("session.create")[0]).toMatchObject({
        cwd: "/home/u/b",
        cwd_explicit: true,
      }),
    );
  });
});

describe("ChatPage T17.5 子代理观测", () => {
  it("toggles the subagents panel for the active session", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "subagent.list") {
        return { subagents: [{ id: "a1", name: "reviewer", status: "running" }] };
      }
      if (method === "delegation.status") {
        return { paused: false };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.click(screen.getByRole("button", { name: "添加附件" }));
    await user.click(screen.getByRole("menuitem", { name: "子代理" }));

    expect(
      await screen.findByRole("button", { name: "查看子代理 reviewer 输出" }),
    ).toBeInTheDocument();
    expect(gateway.paramsOf("subagent.list")).toEqual([{ session_id: "runtime:s1" }]);
  });
});

describe("ChatPage T20.1 Slash 命令菜单", () => {
  it("filters commands while typing and executes slash.exec on select", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "commands.catalog") {
        return {
          commands: [
            { name: "goal", description: "持久目标" },
            { name: "review", description: "代码评审" },
          ],
        };
      }
      if (method === "slash.exec") {
        return { message: "已设置目标" };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "/go");

    expect(await screen.findByText("/goal")).toBeInTheDocument();
    expect(screen.queryByText("/review")).not.toBeInTheDocument();

    await user.click(screen.getByText("/goal"));

    expect(gateway.paramsOf("slash.exec")).toEqual([{ command: "/goal", args: "" }]);
    expect(await screen.findByText("已设置目标")).toBeInTheDocument();
  });
});

describe("ChatPage 会话身份对（stored/runtime id）", () => {
  it("[REQ-001] resumes on selection and submits with the returned runtime id", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    expect(gateway.paramsOf("session.resume")).toEqual([{ session_id: "s1" }]);

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(gateway.paramsOf("prompt.submit")[0]).toMatchObject({ session_id: "runtime:s1" });
  });

  it("[REQ-003] recovers from a 4001 with exactly one resume and one retry", async () => {
    let submits = 0;
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [] };
      }
      if (method === "session.create") {
        return { session_id: "runtime:new", stored_session_id: "stored:new" };
      }
      if (method === "prompt.submit") {
        submits += 1;
        if (submits === 1) {
          const error = new Error("session not found") as Error & { code?: number };
          error.code = 4001;
          throw error;
        }
        return {};
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "新建" }));

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(gateway.paramsOf("prompt.submit")).toHaveLength(2));
    expect(gateway.paramsOf("session.resume")).toEqual([{ session_id: "stored:new" }]);
    expect(gateway.paramsOf("prompt.submit")[0]).toMatchObject({ session_id: "runtime:new" });
    expect(gateway.paramsOf("prompt.submit")[1]).toMatchObject({
      session_id: "runtime:stored:new",
    });
  });

  it("[REQ-004] errors when resume lacks session_id and never uses the stored id as runtime", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "session.resume") {
        return { id: "s1" };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("无法恢复会话")).toBeInTheDocument();
    expect(gateway.paramsOf("prompt.submit")).toHaveLength(0);
    const storedAsRuntime = gateway.requests.filter(
      (entry) => entry.method !== "session.resume" && entry.params.session_id === "s1",
    );
    expect(storedAsRuntime).toEqual([]);
  });

  it("[REQ-005] ignores a late resume response and keeps the newest selection", async () => {
    const pending = new Map<string, (value: unknown) => void>();
    const gateway = createFakeGateway((method, params) => {
      if (method === "session.list") {
        return {
          sessions: [
            { id: "a", title: "会话A" },
            { id: "b", title: "会话B" },
          ],
        };
      }
      if (method === "session.resume") {
        return new Promise((resolve) => {
          pending.set(String(params.session_id), resolve);
        });
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话A" }));
    await user.click(list().getByRole("button", { name: "会话B" }));

    await act(async () => {
      pending.get("a")?.({ session_id: "runtime:a" });
    });
    await act(async () => {
      pending.get("b")?.({ session_id: "runtime:b" });
    });

    await user.type(screen.getByLabelText("消息"), "你好");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() =>
      expect(gateway.paramsOf("prompt.submit")[0]).toMatchObject({ session_id: "runtime:b" }),
    );
  });

  it("[REQ-006] creates without resume and uses stored_session_id as the list id", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [] };
      }
      if (method === "session.create") {
        return { session_id: "runtime:new", stored_session_id: "stored:new" };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "新建" }));

    expect(gateway.paramsOf("session.resume")).toHaveLength(0);
    expect(list().getByRole("button", { name: "新会话" })).toHaveAttribute("data-active", "true");
  });

  it("[REQ-002] ignores events that do not match the active runtime id", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    act(() => {
      gateway.emit("message.delta", { session_id: "runtime:other", text: "不应出现" });
    });
    expect(screen.queryByText("不应出现")).not.toBeInTheDocument();

    act(() => {
      gateway.emit("message.delta", { session_id: "runtime:s1", text: "应出现" });
    });
    expect(screen.getByText("应出现")).toBeInTheDocument();
  });

  it("[REQ-011] clears running on a done event with no session id", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "跑起来");
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByRole("button", { name: "停止" })).toBeInTheDocument();

    act(() => {
      gateway.emit("done", {});
    });
    expect(await screen.findByRole("button", { name: "发送" })).toBeInTheDocument();
  });
});

describe("ChatPage REQ-012 message.complete 结束本轮与推理渲染", () => {
  function makeGateway() {
    return createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
  }

  it("(a) resets the composer to 发送 after message.complete", async () => {
    const gateway = makeGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "跑起来");
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByRole("button", { name: "停止" })).toBeInTheDocument();

    act(() => {
      gateway.emit("message.complete", { session_id: "runtime:s1", text: "完成了" });
    });
    expect(await screen.findByRole("button", { name: "发送" })).toBeInTheDocument();
  });

  it("(b) renders text promoted from reasoning distinctly", async () => {
    const gateway = makeGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "问题");
    await user.click(screen.getByRole("button", { name: "发送" }));

    act(() => {
      gateway.emit("message.complete", {
        session_id: "runtime:s1",
        text: "让我想想",
        reasoning: "让我想想",
      });
    });

    expect(screen.getByText("思考过程")).toBeInTheDocument();
    expect(screen.getByText("让我想想").closest(".bubble")).toHaveAttribute(
      "data-reasoning",
      "true",
    );
  });

  it("(c) leaves a normal completion without the reasoning flag", async () => {
    const gateway = makeGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "问题");
    await user.click(screen.getByRole("button", { name: "发送" }));

    act(() => {
      gateway.emit("message.complete", { session_id: "runtime:s1", text: "正常回复" });
    });
    expect(screen.queryByText("思考过程")).not.toBeInTheDocument();
    expect(screen.getByText("正常回复").closest(".bubble")).not.toHaveAttribute("data-reasoning");

    act(() => {
      gateway.emit("message.complete", {
        session_id: "runtime:s1",
        text: "另一种回复",
        reasoning: "与答复不同的推理",
      });
    });
    expect(screen.queryByText("思考过程")).not.toBeInTheDocument();
    expect(screen.getByText("另一种回复").closest(".bubble")).not.toHaveAttribute("data-reasoning");
  });

  it("(d) still resets the composer on a legacy done event", async () => {
    const gateway = makeGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "跑起来");
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByRole("button", { name: "停止" })).toBeInTheDocument();

    act(() => {
      gateway.emit("done", { session_id: "runtime:s1" });
    });
    expect(await screen.findByRole("button", { name: "发送" })).toBeInTheDocument();
  });
});

describe("ChatPage REQ-020..024 历史消息渲染", () => {
  function historyGateway() {
    return createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "session.resume") {
        return {
          session_id: "runtime:s1",
          messages: [
            { role: "user", text: "旧问", row_id: 1 },
            { role: "assistant", text: "旧答", row_id: 2 },
          ],
        };
      }
      return {};
    });
  }

  it("(a) renders historic user and assistant messages in order", async () => {
    const gateway = historyGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    const question = await screen.findByText("旧问");
    const answer = screen.getByText("旧答");
    expect(
      question.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("(b) renders a historic reasoning-only assistant row distinctly", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "session.resume") {
        return {
          session_id: "runtime:s1",
          messages: [
            { role: "assistant", text: "让我想想", reasoning: "让我想想", row_id: 3 },
          ],
        };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    expect(await screen.findByText("思考过程")).toBeInTheDocument();
    expect(screen.getByText("让我想想").closest(".bubble")).toHaveAttribute(
      "data-reasoning",
      "true",
    );
  });

  it("(c) renders a historic tool row as a completed tool card", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "session.resume") {
        return {
          session_id: "runtime:s1",
          messages: [{ role: "tool", name: "web_search", context: "查询关键词", row_id: 4 }],
        };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    expect(await screen.findByText("web_search")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.getByText("查询关键词")).toBeInTheDocument();
  });

  it("(d) ignores a late history response for a previously selected session", async () => {
    const pending = new Map<string, (value: unknown) => void>();
    const gateway = createFakeGateway((method, params) => {
      if (method === "session.list") {
        return {
          sessions: [
            { id: "a", title: "会话A" },
            { id: "b", title: "会话B" },
          ],
        };
      }
      if (method === "session.resume") {
        return new Promise((resolve) => {
          pending.set(String(params.session_id), resolve);
        });
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话A" }));
    await user.click(list().getByRole("button", { name: "会话B" }));

    await act(async () => {
      pending.get("a")?.({
        session_id: "runtime:a",
        messages: [{ role: "assistant", text: "A历史", row_id: 1 }],
      });
    });
    await act(async () => {
      pending.get("b")?.({
        session_id: "runtime:b",
        messages: [{ role: "assistant", text: "B历史", row_id: 1 }],
      });
    });

    expect(screen.getByText("B历史")).toBeInTheDocument();
    expect(screen.queryByText("A历史")).not.toBeInTheDocument();
  });

  it("(e) keeps history when sending a new message", async () => {
    const gateway = historyGateway();
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));
    await screen.findByText("旧答");

    await user.type(screen.getByLabelText("消息"), "新消息");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByText("新消息")).toBeInTheDocument();
    expect(screen.getAllByText("旧问")).toHaveLength(1);
    expect(screen.getAllByText("旧答")).toHaveLength(1);
  });
});

describe("ChatPage REQ-002/003 中断收尾", () => {
  function makeGateway() {
    return createFakeGateway((method) =>
      method === "session.list" ? { sessions: [{ id: "s1", title: "会话一" }] } : {},
    );
  }

  it("[REQ-003] settles hanging tool cards to interrupted", async () => {
    const gateway = makeGateway();
    const { container } = renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    act(() => {
      gateway.emit("tool.start", { session_id: "runtime:s1", id: "t1", name: "web_search" });
      gateway.emit("tool.generating", { session_id: "runtime:s1", id: "t1", name: "web_search" });
    });
    expect(container.querySelector('[data-status="generating"]')).not.toBeNull();

    act(() => {
      gateway.emit("message.complete", {
        session_id: "runtime:s1",
        status: "interrupted",
        text: "",
      });
    });

    expect(container.querySelector('[data-status="start"]')).toBeNull();
    expect(container.querySelector('[data-status="generating"]')).toBeNull();
    expect(container.querySelector('[data-status="interrupted"]')).not.toBeNull();
  });

  it("[REQ-002] shows 已中断 and never 完成", async () => {
    const gateway = makeGateway();
    const { container } = renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "跑起来");
    await user.click(screen.getByRole("button", { name: "发送" }));

    act(() => {
      gateway.emit("message.complete", {
        session_id: "runtime:s1",
        status: "interrupted",
        text: "",
      });
    });

    expect(container.querySelector('.notice[data-level="interrupted"]')).toHaveTextContent("已中断");
    const bar = screen.getByRole("status");
    expect(bar).toHaveTextContent("已中断");
    expect(bar).not.toHaveTextContent("完成");
  });

  it("[REQ-005] keeps partial streamed text when interrupted with empty text", async () => {
    const gateway = makeGateway();
    const { container } = renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "问题");
    await user.click(screen.getByRole("button", { name: "发送" }));

    act(() => {
      gateway.emit("message.delta", { session_id: "runtime:s1", text: "你好" });
    });
    expect(screen.getByText("你好")).toBeInTheDocument();
    const bubbles = container.querySelectorAll(".bubble").length;

    act(() => {
      gateway.emit("message.complete", {
        session_id: "runtime:s1",
        status: "interrupted",
        text: "",
      });
    });

    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(container.querySelectorAll(".bubble")).toHaveLength(bubbles);
  });

  it("[P1] interrupt notice is idempotent across repeated message.complete", async () => {
    const gateway = makeGateway();
    const { container } = renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    act(() => {
      gateway.emit("message.complete", {
        session_id: "runtime:s1",
        status: "interrupted",
        text: "",
      });
    });
    act(() => {
      gateway.emit("message.complete", {
        session_id: "runtime:s1",
        status: "interrupted",
        text: "",
      });
    });

    expect(container.querySelectorAll('.notice[data-level="interrupted"]')).toHaveLength(1);
  });

  it("[REQ-001] interrupts with the runtime id and resets the primary action", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return { sessions: [{ id: "s1", title: "会话一" }] };
      }
      if (method === "session.interrupt") {
        return { status: "interrupted" };
      }
      return {};
    });
    renderChat(gateway);
    const user = userEvent.setup();
    await user.click(await list().findByRole("button", { name: "会话一" }));

    await user.type(screen.getByLabelText("消息"), "跑起来");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await user.click(screen.getByRole("button", { name: "停止" }));

    expect(gateway.paramsOf("session.interrupt")).toEqual([{ session_id: "runtime:s1" }]);
    expect(await screen.findByRole("button", { name: "发送" })).toBeInTheDocument();
  });
});
