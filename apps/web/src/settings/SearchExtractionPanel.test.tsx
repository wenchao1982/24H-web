/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchExtractionPanel from "./SearchExtractionPanel";
import { normalizeWebSearch, readDocumentExtraction } from "./searchTools";

interface Call {
  method: string;
  body: string | null;
}

function stubFetch(): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      calls.push({ method, body: typeof init.body === "string" ? init.body : null });
      let payload: unknown = {};
      if (method === "GET") {
        payload = String(url).includes("web-search")
          ? { provider: "tavily", keys: { TAVILY_API_KEY: "secret-val" } }
          : { config: { document_extraction: { enabled: false } } };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    }) as unknown as typeof fetch,
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SearchExtractionPanel T23.8 搜索/抽取配置", () => {
  it("renders the provider and masked keys without leaking secret values", async () => {
    stubFetch();
    render(<SearchExtractionPanel />);

    expect(await screen.findByText("provider：tavily")).toBeInTheDocument();
    expect(screen.getByText("TAVILY_API_KEY")).toBeInTheDocument();
    expect(screen.getByLabelText("TAVILY_API_KEY（掩码）")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("secret-val");
  });

  it("toggles document extraction via config", async () => {
    const calls = stubFetch();
    render(<SearchExtractionPanel />);
    const toggle = await screen.findByLabelText("启用文档抽取");

    await userEvent.setup().click(toggle);

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(JSON.stringify({ document_extraction: { enabled: true } }));
    });
  });
});

describe("searchTools normalizer", () => {
  it("normalizes provider, key names and extraction flag", () => {
    expect(normalizeWebSearch({ config: { provider: "tavily", keys: { A: 1 } } })).toEqual({
      provider: "tavily",
      keyNames: ["A"],
      configured: true,
    });
    expect(normalizeWebSearch(null)).toEqual({ provider: "", keyNames: [], configured: false });
    expect(readDocumentExtraction({ document_extraction: { enabled: true } })).toBe(true);
    expect(readDocumentExtraction({ tools: { document_extraction: { enabled: true } } })).toBe(true);
    expect(readDocumentExtraction({})).toBe(false);
  });
});
