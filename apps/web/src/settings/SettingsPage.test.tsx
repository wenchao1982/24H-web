import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./SettingsPage";

interface StubRoute {
  path: string;
  method?: string;
  status: number;
  body: unknown;
}

function stubFetch(handlers: StubRoute[]) {
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
    return {
      ok: hit.status >= 200 && hit.status < 300,
      status: hit.status,
      text: async () => JSON.stringify(hit.body),
    } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("SettingsPage T8.1 Keys 管理", () => {
  it("lists key names (masked) and never renders secret values", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        {
          path: "/api/hermes/env",
          method: "GET",
          status: 200,
          body: {
            keys: [
              { name: "OPENAI_API_KEY", value: "sk-super-secret" },
              { name: "ANTHROPIC_API_KEY", value: "sk-ant-secret" },
            ],
          },
        },
      ]),
    );

    render(<SettingsPage />);

    expect(await screen.findByText("OPENAI_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("ANTHROPIC_API_KEY")).toBeInTheDocument();
    expect(screen.getAllByText("••••••••").length).toBe(2);
    expect(screen.queryByText("sk-super-secret")).not.toBeInTheDocument();
    expect(screen.queryByText("sk-ant-secret")).not.toBeInTheDocument();
  });

  it("posts a new key with the exact body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/env", method: "GET", status: 200, body: { keys: [] } },
      { path: "/api/hermes/env", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SettingsPage />);
    await screen.findByText("暂无密钥。");

    await user.type(screen.getByLabelText("密钥名称"), "GITHUB_TOKEN");
    await user.type(screen.getByLabelText("密钥值"), "ghp_abc");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) => (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(String(call?.[0])).toContain("/api/hermes/env");
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "GITHUB_TOKEN",
        value: "ghp_abc",
      });
    });
  });
});

describe("SettingsPage T8.2 模型设置", () => {
  it("shows the current model, switches it and toggles MoA", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/env", method: "GET", status: 200, body: { keys: [] } },
      { path: "/api/hermes/model/info", method: "GET", status: 200, body: { model: "gpt-4o" } },
      {
        path: "/api/hermes/model/options",
        method: "GET",
        status: 200,
        body: { models: ["gpt-4o", "claude-3"] },
      },
      { path: "/api/hermes/model/moa", method: "GET", status: 200, body: { enabled: false } },
      { path: "/api/hermes/model/set", method: "POST", status: 200, body: { ok: true } },
      { path: "/api/hermes/model/moa", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "模型设置" }));

    expect(await screen.findByLabelText("当前模型")).toHaveTextContent("gpt-4o");

    await user.selectOptions(screen.getByLabelText("选择模型"), "claude-3");
    await user.click(screen.getByRole("button", { name: "切换" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/model/set") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ model: "claude-3" });
    });

    await user.click(screen.getByLabelText("启用 MoA"));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/model/moa") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ enabled: true });
    });
  });
});

describe("SettingsPage T8.3 外观", () => {
  it("toggles the theme and persists it", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/env", method: "GET", status: 200, body: { keys: [] } }]),
    );
    const user = userEvent.setup();

    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "外观" }));

    await user.click(screen.getByRole("radio", { name: "深色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("24h.theme")).toBe("dark");

    await user.click(screen.getByRole("radio", { name: "跟随系统" }));
    expect(localStorage.getItem("24h.theme")).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("SettingsPage T8.4 配置中心", () => {
  it("loads common config fields and saves the changed patch", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/env", method: "GET", status: 200, body: { keys: [] } },
      {
        path: "/api/hermes/config",
        method: "GET",
        status: 200,
        body: {
          config: {
            api_server: { enabled: false },
            tool_search: { enabled: true },
          },
        },
      },
      { path: "/api/hermes/config", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "配置中心" }));

    const apiServer = await screen.findByLabelText("API Server");
    expect(apiServer).not.toBeChecked();
    expect(screen.getByLabelText("工具搜索")).toBeChecked();

    await user.click(apiServer);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/config") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        api_server: { enabled: true },
      });
    });
    expect(await screen.findByText("已保存")).toBeInTheDocument();
  });
});

describe("SettingsPage T8.5 审批策略", () => {
  it("reads and writes approvals.mode", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/env", method: "GET", status: 200, body: { keys: [] } },
      {
        path: "/api/hermes/config",
        method: "GET",
        status: 200,
        body: { config: { approvals: { mode: "manual" } } },
      },
      { path: "/api/hermes/config", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "审批策略" }));

    const select = (await screen.findByLabelText("审批模式")) as HTMLSelectElement;
    expect(select.value).toBe("manual");

    await user.selectOptions(select, "off");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/config") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        approvals: { mode: "off" },
      });
    });
  });
});

describe("SettingsPage T8.6 模型服务商 OAuth", () => {
  it("lists providers and starts the OAuth flow", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/env", method: "GET", status: 200, body: { keys: [] } },
      {
        path: "/api/hermes/providers/oauth",
        method: "GET",
        status: 200,
        body: {
          providers: [
            { id: "openai", name: "OpenAI", connected: false },
            { id: "anthropic", name: "Anthropic", connected: true },
          ],
        },
      },
      {
        path: "/api/hermes/providers/oauth/openai/start",
        method: "POST",
        status: 200,
        body: { url: "https://auth.openai.com/device", user_code: "ABCD-1234" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "服务商登录" }));

    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("未连接")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "授权" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/providers/oauth/openai/start") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
    });
    expect(await screen.findByText("https://auth.openai.com/device")).toBeInTheDocument();
    expect(screen.getByText(/ABCD-1234/)).toBeInTheDocument();
  });
});
