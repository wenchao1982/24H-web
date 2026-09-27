/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProviderRoutingPanel from "./ProviderRoutingPanel";

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

describe("ProviderRoutingPanel T23.3 Provider 路由", () => {
  it("loads provider_routing and saves the edited JSON", async () => {
    const calls = stubFetch({ provider_routing: { order: ["openai"] } });
    render(<ProviderRoutingPanel />);

    const textarea = await screen.findByLabelText("Provider 路由");
    expect(textarea).toHaveValue(JSON.stringify({ order: ["openai"] }, null, 2));

    fireEvent.change(textarea, {
      target: { value: '{"order":["anthropic"],"allow":["anthropic"]}' },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(
        JSON.stringify({ provider_routing: { order: ["anthropic"], allow: ["anthropic"] } }),
      );
    });
    expect(await screen.findByText("已保存")).toBeInTheDocument();
  });

  it("rejects invalid JSON without saving", async () => {
    const calls = stubFetch({ provider_routing: {} });
    render(<ProviderRoutingPanel />);

    const textarea = await screen.findByLabelText("Provider 路由");
    fireEvent.change(textarea, { target: { value: "{not json" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("JSON 格式无效，请检查后再保存")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });
});
