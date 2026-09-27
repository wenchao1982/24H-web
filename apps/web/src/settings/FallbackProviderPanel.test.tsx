/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FallbackProviderPanel from "./FallbackProviderPanel";

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
      const payload = method === "GET" ? { config } : {};
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    }) as unknown as typeof fetch,
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FallbackProviderPanel T23.4 回退 Provider", () => {
  it("loads fallback config and saves under the fallback key", async () => {
    const calls = stubFetch({ fallback: { main: "anthropic", auxiliary: "openai" } });
    render(<FallbackProviderPanel />);

    const textarea = await screen.findByLabelText("回退 Provider");
    expect(textarea).toHaveValue(
      JSON.stringify({ main: "anthropic", auxiliary: "openai" }, null, 2),
    );

    fireEvent.change(textarea, {
      target: { value: '{"main":"anthropic","auxiliary":"google"}' },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(
        JSON.stringify({ fallback: { main: "anthropic", auxiliary: "google" } }),
      );
    });
  });
});
