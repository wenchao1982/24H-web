/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiServerPanel from "./ApiServerPanel";

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

describe("ApiServerPanel T23.6 API Server（schema 驱动 · C04）", () => {
  it("renders schema fields for gateway.api_server and saves nested changes", async () => {
    const calls = stubFetch(
      {
        fields: {
          "gateway.api_server.max_concurrent_runs": {
            type: "integer",
            description: "最大并发",
            category: "gateway",
          },
          "gateway.api_server.history_tool_output_max_chars": {
            type: "integer",
            description: "历史截断",
            category: "gateway",
          },
        },
        category_order: [],
      },
      { gateway: { api_server: { max_concurrent_runs: 10, history_tool_output_max_chars: 0 } } },
    );
    render(<ApiServerPanel />);

    const concurrency = await screen.findByLabelText("最大并发");
    expect(concurrency).toHaveValue(10);

    fireEvent.change(concurrency, { target: { value: "20" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put?.body).toBe(
        JSON.stringify({ gateway: { api_server: { max_concurrent_runs: 20 } } }),
      );
    });
  });

  it("shows a note when there are no schema fields", async () => {
    stubFetch({ fields: {}, category_order: [] }, {});
    render(<ApiServerPanel />);
    expect(
      await screen.findByText("该功能在当前 Hermes 版本无对应配置项。"),
    ).toBeInTheDocument();
  });
});
