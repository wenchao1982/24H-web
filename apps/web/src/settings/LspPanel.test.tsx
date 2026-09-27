/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LspPanel from "./LspPanel";

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

describe("LspPanel T23.11 LSP", () => {
  it("loads and saves lsp servers JSON", async () => {
    const calls = stubFetch({ lsp: { servers: { tsserver: { command: "typescript-language-server" } } } });
    render(<LspPanel />);

    const textarea = await screen.findByLabelText("LSP");
    expect(textarea).toHaveValue(
      JSON.stringify({ servers: { tsserver: { command: "typescript-language-server" } } }, null, 2),
    );

    fireEvent.change(textarea, {
      target: { value: '{"servers":{"gopls":{"command":"gopls"}}}' },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(JSON.stringify({ lsp: { servers: { gopls: { command: "gopls" } } } }));
    });
  });
});
