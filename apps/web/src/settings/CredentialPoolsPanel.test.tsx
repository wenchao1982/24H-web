/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CredentialPoolsPanel from "./CredentialPoolsPanel";
import { normalizeCredentialPools } from "./credentialPools";

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

describe("CredentialPoolsPanel T23.5 凭证池", () => {
  it("lists providers with masked keys and never renders raw values", async () => {
    stubFetch({
      credential_pools: { openai: ["sk-secret"], anthropic: { keys: ["a", "b"] } },
    });
    render(<CredentialPoolsPanel />);

    expect(await screen.findByText("openai")).toBeInTheDocument();
    expect(screen.getByText("1 个密钥")).toBeInTheDocument();
    expect(screen.getByText("2 个密钥")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("sk-secret");
  });

  it("appends a new key and writes the merged pool", async () => {
    const calls = stubFetch({ credential_pools: { openai: ["sk-old"] } });
    render(<CredentialPoolsPanel />);
    await screen.findByText("1 个密钥");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("新密钥"), "sk-new");
    await user.click(screen.getByRole("button", { name: "添加凭证" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put).toBeTruthy();
      const parsed = JSON.parse(put?.body ?? "{}") as {
        credential_pools?: { openai?: unknown[] };
      };
      expect(parsed.credential_pools?.openai).toHaveLength(2);
      expect(parsed.credential_pools?.openai).toContain("sk-new");
    });
    expect(await screen.findByText("2 个密钥")).toBeInTheDocument();
  });
});

describe("credentialPools normalizer", () => {
  it("normalizes arrays, objects and string values", () => {
    const state = normalizeCredentialPools({
      credential_pools: { openai: ["k1", "k2"], gemini: { tokens: ["t"] }, solo: "s" },
    });
    expect(state.providers).toEqual([
      { provider: "openai", count: 2 },
      { provider: "gemini", count: 1 },
      { provider: "solo", count: 1 },
    ]);
    expect(normalizeCredentialPools({}).providers).toEqual([]);
  });
});
