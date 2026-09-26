import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilesPanel from "./FilesPanel";

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

describe("FilesPanel T11.1 文件面板", () => {
  it("lists files and opens one via /api/hermes/files/read", async () => {
    const fetchMock = stubFetch([
      {
        path: "/api/hermes/files",
        method: "GET",
        status: 200,
        body: {
          files: [
            { name: "README.md", path: "README.md", type: "file" },
            { name: "src", path: "src", type: "dir" },
          ],
        },
      },
      {
        path: "/api/hermes/files/read",
        method: "GET",
        status: 200,
        body: { content: "# Hello", path: "README.md" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<FilesPanel />);

    expect(await screen.findByText(/README\.md/)).toBeInTheDocument();
    expect(screen.getByText(/src/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /README\.md/ }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((entry) =>
        String(entry[0]).includes("/api/hermes/files/read"),
      );
      expect(call).toBeTruthy();
      expect(String(call?.[0])).toContain("path=README.md");
    });
    expect(await screen.findByText("# Hello")).toBeInTheDocument();
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

    render(<FilesPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法连接 Hermes 上游");
  });
});
