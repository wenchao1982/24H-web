/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComputerUsePanel from "./ComputerUsePanel";
import { normalizeComputerUse } from "./computerUse";

interface Call {
  method: string;
  url: string;
  body: string | null;
}

function stubFetch(statuses: unknown[]): Call[] {
  const calls: Call[] = [];
  let index = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      calls.push({ method, url: String(url), body: typeof init.body === "string" ? init.body : null });
      const payload = method === "GET" ? statuses[Math.min(index++, statuses.length - 1)] : {};
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    }) as unknown as typeof fetch,
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ComputerUsePanel T23.12 Computer Use", () => {
  it("shows status and grants permissions", async () => {
    const calls = stubFetch([
      { available: true, granted: false, permissions: ["screen"] },
      { available: true, granted: true, permissions: ["screen", "computer_use"] },
    ]);
    render(<ComputerUsePanel />);

    expect(await screen.findByText("未授权")).toBeInTheDocument();
    expect(screen.getByLabelText("Computer Use 可用性")).toHaveTextContent("可用");

    await userEvent.setup().click(screen.getByRole("button", { name: "授予权限" }));

    await waitFor(() => {
      expect(
        calls.some(
          (call) => call.method === "POST" && call.url.includes("/computer-use/permissions/grant"),
        ),
      ).toBe(true);
    });
    expect(await screen.findByText("已授权")).toBeInTheDocument();
  });
});

describe("computerUse normalizer", () => {
  it("normalizes availability, granted and permissions", () => {
    expect(normalizeComputerUse({ enabled: true, granted: true, permissions: [{ name: "screen" }] })).toEqual({
      available: true,
      granted: true,
      permissions: ["screen"],
    });
    expect(normalizeComputerUse(null)).toEqual({ available: false, granted: false, permissions: [] });
  });
});
