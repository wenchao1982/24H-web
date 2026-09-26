import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GitPanel from "./GitPanel";

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

describe("GitPanel T11.4 Git 面板", () => {
  it("renders branch, changes and diff", async () => {
    const fetchMock = stubFetch([
      {
        path: "/api/hermes/git/status",
        method: "GET",
        status: 200,
        body: {
          branch: "main",
          clean: false,
          files: [
            { path: "src/app.ts", status: "M" },
            { path: "README.md", status: "??" },
          ],
        },
      },
      {
        path: "/api/hermes/git/diff",
        method: "GET",
        status: 200,
        body: { diff: "--- a/src/app.ts\n+++ b/src/app.ts\n+new line" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    render(<GitPanel />);

    expect(await screen.findByLabelText("Git 分支")).toHaveTextContent("main");
    expect(screen.getByLabelText("Git 状态")).toHaveTextContent("2 个变更");
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByLabelText("Git 差异")).toHaveTextContent("+new line");
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

    render(<GitPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法连接 Hermes 上游");
  });
});
