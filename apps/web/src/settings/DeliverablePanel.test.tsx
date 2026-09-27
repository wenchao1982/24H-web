/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeliverablePanel from "./DeliverablePanel";

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

describe("DeliverablePanel T23.13 Deliverable Mode", () => {
  it("toggles deliverable.enabled", async () => {
    const calls = stubFetch({ deliverable: { enabled: false } });
    render(<DeliverablePanel />);

    const toggle = await screen.findByLabelText("启用 Deliverable 模式");
    expect(toggle).not.toBeChecked();

    const user = userEvent.setup();
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(JSON.stringify({ deliverable: { enabled: true } }));
    });
  });
});
