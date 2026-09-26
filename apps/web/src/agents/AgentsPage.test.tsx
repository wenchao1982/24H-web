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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentsPage T7.1 技能列表", () => {
  it("renders skills grouped by category", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/skills", method: "GET", status: 200, body: SKILLS }]),
    );

    render(<AgentsPage />);

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

    render(<AgentsPage />);

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

    render(<AgentsPage />);
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

    render(<AgentsPage />);
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

    render(<AgentsPage />);
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

    render(
      <GatewayProvider gateway={gateway}>
        <AgentsPage />
      </GatewayProvider>,
    );
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

    render(<AgentsPage />);
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

    render(<AgentsPage />);
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

    render(
      <GatewayProvider gateway={gateway}>
        <AgentsPage />
      </GatewayProvider>,
    );

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

