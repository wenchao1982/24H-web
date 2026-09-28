import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentsPage from "./AgentsPage";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";

interface StubRoute {
  path: string;
  method?: string;
  status: number;
  body: unknown;
}

export function jsonResponse(hit: StubRoute): Response {
  return {
    ok: hit.status >= 200 && hit.status < 300,
    status: hit.status,
    text: async () => JSON.stringify(hit.body),
  } as Response;
}

export function stubFetch(handlers: StubRoute[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const hit = handlers.find(
      (handler) =>
        url.split("?")[0].endsWith(handler.path) &&
        (!handler.method || handler.method === method),
    );
    if (!hit) {
      return { ok: false, status: 404, text: async () => "" } as Response;
    }
    return jsonResponse(hit);
  });
}

const SKILLS = {
  skills: [
    { name: "web_search", description: "联网搜索", category: "检索", enabled: true },
    { name: "ppt", description: "生成 PPT", category: "创作", enabled: false },
    { name: "outline", description: "大纲生成", category: "创作", enabled: true },
  ],
};

/** 用假网关渲染 AgentsPage（默认返回空 agent 列表，避免真实 WebSocket）。 */
function renderAgents(
  gateway = createFakeGateway((method) =>
    method === "profiles.list" ? { profiles: [] } : {},
  ),
) {
  return render(
    <GatewayProvider gateway={gateway}>
      <AgentsPage />
    </GatewayProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentsPage T7.1 技能列表", () => {
  it("renders skills grouped by category", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );

    renderAgents();

    expect(await screen.findByRole("heading", { name: "检索" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "创作" })).toBeInTheDocument();
    expect(screen.getByText("web_search")).toBeInTheDocument();
    expect(screen.getByText("ppt")).toBeInTheDocument();
    expect(screen.getByText("outline")).toBeInTheDocument();
  });

  it("shows an empty state when there are no skills", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: { skills: [] } }]),
    );

    renderAgents();

    expect(await screen.findByText("暂无技能。")).toBeInTheDocument();
  });
});

describe("AgentsPage T7.2 技能启停", () => {
  it("toggles a skill with the exact PUT body and updates the UI", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      { path: "/api/hermes/skills/toggle", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents();
    const toggle = await screen.findByLabelText("启用 ppt");
    expect((toggle as HTMLInputElement).checked).toBe(false);

    await user.click(toggle);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((entry) =>
        String(entry[0]).endsWith("/api/hermes/skills/toggle"),
      );
      expect(call).toBeTruthy();
      expect((call?.[1] as RequestInit).method).toBe("PUT");
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "ppt",
        enabled: true,
      });
    });
    expect((screen.getByLabelText("启用 ppt") as HTMLInputElement).checked).toBe(true);
  });
});

describe("AgentsPage T7.3 工具 / Toolsets", () => {
  it("renders toolsets, toggles one and opens its config", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      {
        path: "/api/hermes/tools/toolsets",
        method: "GET",
        status: 200,
        body: {
          toolsets: [
            { name: "web", description: "联网检索", enabled: true },
            { name: "code", description: "代码执行", enabled: false },
          ],
        },
      },
      {
        path: "/api/hermes/tools/toolsets/web",
        method: "PUT",
        status: 200,
        body: { ok: true },
      },
      {
        path: "/api/hermes/tools/toolsets/web/config",
        method: "GET",
        status: 200,
        body: { provider: "duckduckgo" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents();
    await user.click(await screen.findByRole("tab", { name: "工具" }));

    expect(await screen.findByText("web")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();

    await user.click(screen.getByLabelText("启用工具集 web"));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/tools/toolsets/web") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ enabled: false });
    });
    expect((screen.getByLabelText("启用工具集 web") as HTMLInputElement).checked).toBe(false);

    const webRow = screen.getByText("web").closest("li") as HTMLLIElement;
    await user.click(within(webRow).getByRole("button", { name: "配置" }));
    expect(await screen.findByText(/"provider": "duckduckgo"/)).toBeInTheDocument();
  });
});

describe("AgentsPage T7.4 MCP 管理", () => {
  it("lists MCP servers and adds one with the exact POST body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      {
        path: "/api/hermes/mcp/servers",
        method: "GET",
        status: 200,
        body: {
          servers: [{ name: "filesystem", command: "npx mcp-fs", enabled: true }],
        },
      },
      { path: "/api/hermes/mcp/servers", method: "POST", status: 201, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents();
    await user.click(await screen.findByRole("tab", { name: "MCP" }));

    expect(await screen.findByText("filesystem")).toBeInTheDocument();
    expect(screen.getByLabelText("启用 MCP filesystem")).toBeChecked();

    await user.type(screen.getByLabelText("MCP 名称"), "github");
    await user.type(screen.getByLabelText("MCP 命令"), "npx mcp-github");
    await user.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/mcp/servers") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "github",
        command: "npx mcp-github",
      });
    });
  });
});

describe("AgentsPage T7.5 插件", () => {
  it("lists plugins via plugins.manage and enables one", async () => {
    const gateway = createFakeGateway((method, params) => {
      if (method === "plugins.manage" && params.action === "list") {
        return { plugins: [{ name: "hello", version: "1.0.0", enabled: false }] };
      }
      return {};
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );
    const user = userEvent.setup();

    renderAgents(gateway);
    await user.click(await screen.findByRole("tab", { name: "插件" }));

    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(screen.getByLabelText("启用插件 hello")).not.toBeChecked();

    await user.click(screen.getByLabelText("启用插件 hello"));
    await waitFor(() => {
      expect(gateway.paramsOf("plugins.manage")).toContainEqual({
        action: "enable",
        name: "hello",
      });
    });
    expect(screen.getByLabelText("启用插件 hello")).toBeChecked();
  });
});

describe("AgentsPage T7.6 技能安装（hub）", () => {
  it("searches the hub and installs a skill", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      {
        path: "/api/hermes/skills/hub",
        method: "GET",
        status: 200,
        body: { results: [{ name: "translate", description: "翻译" }] },
      },
      { path: "/api/hermes/skills", method: "POST", status: 201, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents();
    await screen.findByRole("heading", { name: "检索" });

    await user.type(screen.getByLabelText("搜索技能市场"), "翻译");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(await screen.findByText("translate")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "安装" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/skills") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ name: "translate" });
    });
    const hubCall = fetchMock.mock.calls.find((entry) =>
      String(entry[0]).includes("/api/hermes/skills/hub?q="),
    );
    expect(String(hubCall?.[0])).toContain("q=%E7%BF%BB%E8%AF%91");
  });
});

describe("AgentsPage T7.7 技能内容编辑", () => {
  it("loads skill content and saves the edited text", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      {
        path: "/api/hermes/skills/content",
        method: "GET",
        status: 200,
        body: { name: "web_search", content: "# web_search\n步骤一" },
      },
      { path: "/api/hermes/skills/content", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents();
    await screen.findByRole("heading", { name: "检索" });

    await user.click(screen.getByLabelText("编辑 web_search"));
    const textarea = (await screen.findByLabelText("技能内容 web_search")) as HTMLTextAreaElement;
    expect(textarea.value).toContain("# web_search");

    await user.clear(textarea);
    await user.type(textarea, "新内容");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/skills/content") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "web_search",
        content: "新内容",
      });
    });
  });
});

describe("AgentsPage T7.8 经验→Skill（/learn）", () => {
  it("submits /learn through the gateway slash.exec", async () => {
    const gateway = createFakeGateway(() => ({}));
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );
    const user = userEvent.setup();

    renderAgents(gateway);

    await user.type(screen.getByLabelText("学习来源"), "从部署经验生成");
    await user.click(screen.getByRole("button", { name: "生成技能" }));

    await waitFor(() => {
      expect(gateway.paramsOf("slash.exec")).toEqual([
        { command: "/learn", args: "从部署经验生成" },
      ]);
    });
    expect(await screen.findByText("已提交生成技能")).toBeInTheDocument();
  });
});

describe("AgentsPage T16.1 Agent 列表/详情", () => {
  it("renders the agent list from profiles.list", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "profiles.list") {
        return {
          profiles: [
            {
              name: "writer",
              display_name: "写作",
              model: "gpt-4o",
              skill_count: 2,
              is_default: true,
            },
            { name: "coder", model: "claude-3", worker_session: { id: "s1" } },
          ],
        };
      }
      return {};
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );

    renderAgents(gateway);

    expect(await screen.findByRole("button", { name: /写作/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /coder/ })).toBeInTheDocument();
    expect(gateway.paramsOf("profiles.list")).toEqual([{ include_sessions: false }]);
  });

  it("selecting an agent calls profiles.describe, renders detail and scopes the skills panel", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "profiles.list") {
        return { profiles: [{ name: "writer", display_name: "写作" }] };
      }
      if (method === "profiles.describe") {
        return {
          name: "writer",
          description: "文案助手",
          soul: "你是写作助手",
          model: { provider: "openai", default: "gpt-4o" },
          skills: [
            { name: "web_search", enabled: true },
            { name: "ppt", enabled: false },
          ],
          mcp_servers: [{ name: "filesystem", enabled: true, transport: "stdio" }],
        };
      }
      return {};
    });
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents(gateway);
    await user.click(await screen.findByRole("button", { name: /写作/ }));

    await waitFor(() => {
      expect(gateway.paramsOf("profiles.describe")).toEqual([{ name: "writer" }]);
    });
    await user.click(screen.getByRole("tab", { name: "SOUL" }));
    expect(await screen.findByText("你是写作助手")).toBeInTheDocument();
    expect(screen.getByText("文案助手")).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();

    await waitFor(() => {
      const scoped = fetchMock.mock.calls.find((entry) =>
        String(entry[0]).includes("/api/hermes/skills?profile=writer"),
      );
      expect(scoped).toBeTruthy();
    });
  });
});

describe("AgentsPage T16.2 创建/克隆", () => {
  it("creates a profile via profiles.create with the exact params", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "profiles.list") {
        return { profiles: [] };
      }
      if (method === "profiles.create") {
        return { ok: true, name: "writer" };
      }
      if (method === "profiles.describe") {
        return { name: "writer" };
      }
      return {};
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );
    const user = userEvent.setup();

    renderAgents(gateway);
    await user.click(await screen.findByRole("button", { name: "新建" }));
    await user.type(screen.getByLabelText("智能体名称"), "writer");
    await user.type(screen.getByLabelText("智能体描述"), "文案助手");
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => {
      expect(gateway.paramsOf("profiles.create")).toEqual([
        { name: "writer", description: "文案助手" },
      ]);
    });
  });

  it("clones the selected profile with clone_from", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "profiles.list") {
        return { profiles: [{ name: "writer", display_name: "写作" }] };
      }
      if (method === "profiles.describe") {
        return { name: "writer" };
      }
      if (method === "profiles.create") {
        return { ok: true, name: "writer-copy" };
      }
      return {};
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );
    const user = userEvent.setup();

    renderAgents(gateway);
    await user.click(await screen.findByRole("button", { name: /写作/ }));
    await user.click(await screen.findByRole("button", { name: "克隆" }));
    await user.type(screen.getByLabelText("智能体名称"), "writer-copy");
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => {
      expect(gateway.paramsOf("profiles.create")).toEqual([
        { name: "writer-copy", clone_from: "writer" },
      ]);
    });
  });
});

describe("AgentsPage T16.3 编辑", () => {
  it("saving SOUL calls profiles.configure with soul and disabled_skills", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "profiles.list") {
        return { profiles: [{ name: "writer", display_name: "写作" }] };
      }
      if (method === "profiles.describe") {
        return {
          name: "writer",
          soul: "旧的人设",
          model: { provider: "openai", default: "gpt-4o" },
          skills: [
            { name: "web_search", enabled: true },
            { name: "ppt", enabled: false },
          ],
        };
      }
      if (method === "profiles.configure") {
        return { ok: true, applied: { soul: true, skills: true } };
      }
      return {};
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );
    const user = userEvent.setup();

    renderAgents(gateway);
    await user.click(await screen.findByRole("button", { name: /写作/ }));
    await user.click(await screen.findByRole("button", { name: "编辑" }));

    const soul = (await screen.findByLabelText("SOUL 内容")) as HTMLTextAreaElement;
    expect(soul.value).toBe("旧的人设");
    await user.clear(soul);
    await user.type(soul, "新的人设");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(gateway.paramsOf("profiles.configure")).toEqual([
        { name: "writer", soul: "新的人设", disabled_skills: ["ppt"] },
      ]);
    });
  });
});

describe("AgentsPage T16.4 删除/导出导入", () => {
  const gatewayWith = () =>
    createFakeGateway((method) => {
      if (method === "profiles.list") {
        return { profiles: [{ name: "writer", display_name: "写作" }] };
      }
      if (method === "profiles.describe") {
        return { name: "writer" };
      }
      return {};
    });

  it("deletes the selected profile after confirmation", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      { path: "/api/hermes/profiles/writer", method: "DELETE", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents(gatewayWith());
    await user.click(await screen.findByRole("button", { name: /写作/ }));
    await user.click(await screen.findByRole("button", { name: "删除" }));
    await user.click(await screen.findByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).includes("/api/hermes/profiles/writer") &&
          (entry[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(call).toBeTruthy();
    });
  });

  it("exports the selected profile via POST", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      {
        path: "/api/hermes/profiles/writer/export",
        method: "POST",
        status: 200,
        body: { ok: true, archive: "/tmp/writer.zip" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents(gatewayWith());
    await user.click(await screen.findByRole("button", { name: /写作/ }));
    await user.click(await screen.findByRole("button", { name: "导出" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).includes("/api/hermes/profiles/writer/export") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
    });
    expect(await screen.findByText("已导出：/tmp/writer.zip")).toBeInTheDocument();
  });

  it("imports a profile with the archive path", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS },
      {
        path: "/api/hermes/profiles/import",
        method: "POST",
        status: 200,
        body: { ok: true, name: "restored" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents();
    await user.click(await screen.findByRole("button", { name: "导入" }));
    await user.type(screen.getByLabelText("导入归档路径"), "/tmp/backup.zip");
    await user.click(screen.getByLabelText("确认导入"));
    await user.click(screen.getByRole("button", { name: "执行导入" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/profiles/import") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        archive: "/tmp/backup.zip",
      });
    });
  });
});

describe("AgentsPage T16.5 头像", () => {
  it("uploads an avatar via profiles.set_asset and reflects it on GET", async () => {
    let stored: string | null = null;
    const gateway = createFakeGateway((method, params) => {
      if (method === "profiles.list") {
        return { profiles: [{ name: "writer", display_name: "写作" }] };
      }
      if (method === "profiles.describe") {
        return { name: "writer", display_name: "写作" };
      }
      if (method === "profiles.get_asset") {
        return stored ? { found: true, data: stored } : { found: false };
      }
      if (method === "profiles.set_asset") {
        stored = String(params.data);
        return { ok: true };
      }
      return {};
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const path = url.split("?")[0];
      if (path.endsWith("/api/hermes/skills") && method === "GET") {
        return jsonResponse({ path: "", status: 200, body: SKILLS });
      }
      if (path.endsWith("/api/hermes/profiles/writer/avatar") && method === "GET") {
        if (stored) {
          return jsonResponse({ path: "", status: 200, body: { avatar: stored } });
        }
        return { ok: false, status: 404, text: async () => "" } as Response;
      }
      return { ok: false, status: 404, text: async () => "" } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAgents(gateway);
    await user.click(await screen.findByRole("button", { name: /写作/ }));

    expect(screen.queryByAltText("写作 头像")).toBeNull();

    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([bytes], "avatar.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("上传头像"), file);

    await waitFor(() => {
      const params = gateway.paramsOf("profiles.set_asset")[0];
      expect(params).toMatchObject({ name: "writer", asset: "avatar" });
      expect(String(params.data)).toContain("data:image/png;base64,");
    });

    const img = await screen.findByAltText("写作 头像");
    expect(img.getAttribute("src")).toContain("data:image/png;base64,");
  });
});

