import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentsPage from "./AgentsPage";

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

