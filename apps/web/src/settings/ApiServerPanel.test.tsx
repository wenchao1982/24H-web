/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiServerPanel from "./ApiServerPanel";

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

describe("ApiServerPanel T23.6 API Server", () => {
  it("loads enabled/port and saves changes", async () => {
    const calls = stubFetch({ api_server: { enabled: true, port: 8000 } });
    render(<ApiServerPanel />);

    const toggle = await screen.findByLabelText("启用 API Server");
    expect(toggle).toBeChecked();
    expect(screen.getByLabelText("端口")).toHaveValue(8000);

    const user = userEvent.setup();
    await user.click(toggle);
    fireEvent.change(screen.getByLabelText("端口"), { target: { value: "9000" } });
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(JSON.stringify({ api_server: { enabled: false, port: 9000 } }));
    });
  });
});
