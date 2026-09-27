import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemoryPanel from "./MemoryPanel";
import { normalizeMemory } from "./memory";

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

const MEMORY = {
  provider: "sqlite",
  providers: ["sqlite", "redis"],
  sizes: { entries: 128, bytes: "12 MB" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MemoryPanel T17.3 记忆", () => {
  it("renders the provider and sizes", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/memory", method: "GET", status: 200, body: MEMORY }]),
    );
    render(<MemoryPanel />);

    const select = (await screen.findByLabelText("选择提供方")) as HTMLSelectElement;
    expect(select.value).toBe("sqlite");
    expect(screen.getByText("entries")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("12 MB")).toBeInTheDocument();
  });

  it("switches the provider with the right PUT body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/memory", method: "GET", status: 200, body: MEMORY },
      { path: "/api/hermes/memory/provider", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryPanel />);
    await screen.findByLabelText("选择提供方");

    await user.selectOptions(screen.getByLabelText("选择提供方"), "redis");

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/memory/provider") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ provider: "redis" });
    });
  });

  it("resets memory via POST", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/memory", method: "GET", status: 200, body: MEMORY },
      { path: "/api/hermes/memory/reset", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryPanel />);
    await screen.findByLabelText("选择提供方");

    await user.click(screen.getByRole("button", { name: "重置记忆" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/memory/reset") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
    });
    expect(await screen.findByText("无记忆数据。")).toBeInTheDocument();
  });
});

describe("memory normalizer", () => {
  it("normalizes providers as strings/objects and entries from an object", () => {
    expect(
      normalizeMemory({
        active_provider: "memory",
        available_providers: ["memory", { id: "redis", label: "Redis" }],
        stats: { count: 3 },
      }),
    ).toEqual({
      provider: "memory",
      providers: [
        { id: "memory", name: "memory" },
        { id: "redis", name: "Redis" },
      ],
      entries: [{ label: "count", value: "3" }],
    });
    expect(normalizeMemory(null)).toEqual({ provider: "", providers: [], entries: [] });
  });
});
