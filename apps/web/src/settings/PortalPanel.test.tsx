import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PortalPanel from "./PortalPanel";
import { formatUsage, normalizePortal } from "./portal";

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

describe("PortalPanel T18.3 门户信息", () => {
  it("renders the plan, status, usage and the usage entry", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        {
          path: "/api/hermes/portal",
          method: "GET",
          status: 200,
          body: {
            plan: "Pro",
            status: "active",
            renews_at: "2026-10-01",
            usage: { used: 1200, limit: 10000, unit: "tokens" },
          },
        },
      ]),
    );

    render(<PortalPanel />);

    expect(await screen.findByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("1,200 / 10,000 tokens")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看用量" })).toHaveAttribute("href", "/usage");
  });

  it("shows an empty state when the portal has no plan", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/portal", method: "GET", status: 200, body: {} }]),
    );
    render(<PortalPanel />);
    expect(await screen.findByText("暂无门户信息。")).toBeInTheDocument();
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizePortal({ subscription: { plan: "Free" } })).toEqual({ plan: "Free" });
    expect(normalizePortal({ plan: { name: "Team", status: "past_due" } })).toEqual({
      plan: "Team",
      status: "past_due",
    });
    expect(normalizePortal(null)).toBeNull();
    expect(formatUsage({ used: 5, limit: 10, unit: "GB", label: "存储" })).toBe("存储 5 / 10 GB");
    expect(formatUsage({ label: "无限" })).toBe("无限");
  });
});
