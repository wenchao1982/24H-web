import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogsPanel from "./LogsPanel";

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

describe("LogsPanel T11.2 日志面板", () => {
  it("loads logs and refetches with the selected level", async () => {
    const fetchMock = stubFetch([
      {
        path: "/api/hermes/logs",
        method: "GET",
        status: 200,
        body: { lines: ["2026-09-27 INFO started", "2026-09-27 ERROR boom"] },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<LogsPanel />);

    expect(await screen.findByLabelText("日志内容")).toHaveTextContent("ERROR boom");
    const firstCall = fetchMock.mock.calls[0];
    expect(String(firstCall?.[0])).toContain("lines=200");
    expect(String(firstCall?.[0])).not.toContain("level=");

    await user.selectOptions(screen.getByLabelText("日志级别"), "error");

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("level=error"));
      expect(call).toBeTruthy();
    });
  });

  it("shows a graceful error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        text: async () =>
          JSON.stringify({ error: "HERMES_UNREACHABLE", message: "无法连接 Hermes 上游" }),
      })) as unknown as typeof fetch,
    );

    render(<LogsPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法连接 Hermes 上游");
  });
});
