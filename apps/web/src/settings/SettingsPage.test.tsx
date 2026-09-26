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
