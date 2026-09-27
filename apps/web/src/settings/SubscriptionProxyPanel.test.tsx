/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubscriptionProxyPanel from "./SubscriptionProxyPanel";

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

describe("SubscriptionProxyPanel T23.17 Subscription Proxy", () => {
  it("loads and saves subscription_proxy config", async () => {
    const calls = stubFetch({ subscription_proxy: { enabled: false, endpoint: "https://x" } });
    render(<SubscriptionProxyPanel />);

    const textarea = await screen.findByLabelText("Subscription Proxy");
    expect(textarea).toHaveValue(
      JSON.stringify({ enabled: false, endpoint: "https://x" }, null, 2),
    );

    fireEvent.change(textarea, { target: { value: '{"enabled":true}' } });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(JSON.stringify({ subscription_proxy: { enabled: true } }));
    });
  });
});
