/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ToolSearchPanel from "./ToolSearchPanel";

interface Call {
  method: string;
  body: string | null;
}

function stubFetch(config: unknown): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      calls.push({ method, body: typeof init.body === "string" ? init.body : null });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(method === "GET" ? { config } : {}),
      };
    }) as unknown as typeof fetch,
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ToolSearchPanel T23.10 Tool Search", () => {
  it("toggles tool_search.enabled", async () => {
    const calls = stubFetch({ tool_search: { enabled: false } });
    render(<ToolSearchPanel />);

    const toggle = await screen.findByLabelText("启用工具搜索");
    expect(toggle).not.toBeChecked();

    const user = userEvent.setup();
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(JSON.stringify({ tool_search: { enabled: true } }));
    });
  });
});
