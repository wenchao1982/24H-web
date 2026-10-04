/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ToolSearchPanel from "./ToolSearchPanel";

interface Call {
  method: string;
  body: string | null;
}

function stubFetch(schema: unknown, config: unknown): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      calls.push({ method, body: typeof init.body === "string" ? init.body : null });
      const path = String(url).split("?")[0];
      const body =
        method === "GET"
          ? path.endsWith("/config/schema")
            ? schema
            : { config }
          : {};
      return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
    }) as unknown as typeof fetch,
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ToolSearchPanel T23.10 Tool Search（schema 驱动 · C04）", () => {
  it("renders the enabled select and saves the enum value nested under tools.tool_search", async () => {
    const calls = stubFetch(
      {
        fields: {
          "tools.tool_search.enabled": {
            type: "string",
            description: "工具搜索模式",
            category: "tools",
            options: ["auto", "on", "off"],
          },
        },
        category_order: [],
      },
      { tools: { tool_search: { enabled: "auto" } } },
    );
    render(<ToolSearchPanel />);

    const select = await screen.findByLabelText("工具搜索模式");
    expect(select).toHaveValue("auto");

    fireEvent.change(select, { target: { value: "on" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(JSON.stringify({ tools: { tool_search: { enabled: "on" } } }));
    });
  });
});
