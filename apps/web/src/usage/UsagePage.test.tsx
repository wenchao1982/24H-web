import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import UsagePage from "./UsagePage";

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
});

describe("UsagePage T10.1 用量概览", () => {
  it("renders sessions/messages summary from usage and system stats", async () => {
    const fetchMock = stubFetch([
      {
        path: "/api/hermes/analytics/usage",
        method: "GET",
        status: 200,
        body: { sessions: 12, messages: 345, tokens: 6789, cost: 1.5 },
      },
      {
        path: "/api/hermes/system/stats",
        method: "GET",
        status: 200,
        body: { health: "ok", uptime: 7320 },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    render(<UsagePage />);

    expect(await screen.findByLabelText("会话数")).toHaveTextContent("12");
    expect(screen.getByLabelText("消息数")).toHaveTextContent("345");
    expect(screen.getByLabelText("令牌数")).toHaveTextContent("6789");
    expect(screen.getByLabelText("费用")).toHaveTextContent("1.50");
    expect(screen.getByLabelText("系统健康")).toHaveTextContent("ok");
    expect(screen.getByLabelText("运行时长")).toHaveTextContent("2 小时 2 分");

    const usageCall = fetchMock.mock.calls.find((entry) =>
      String(entry[0]).includes("/api/hermes/analytics/usage"),
    );
    expect(String(usageCall?.[0])).toContain("days=30");
  });

  it("shows a graceful error state on proxy failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        text: async () =>
          JSON.stringify({ error: "HERMES_UNREACHABLE", message: "无法连接 Hermes 上游" }),
      })) as unknown as typeof fetch,
    );

    render(<UsagePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("无法连接 Hermes 上游");
  });
});
