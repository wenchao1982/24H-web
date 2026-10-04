/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ToolGatewayPanel from "./ToolGatewayPanel";

function stubFetch(schema: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      const path = String(url).split("?")[0];
      const body =
        method === "GET" ? (path.endsWith("/config/schema") ? schema : { config: {} }) : {};
      return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
    }) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ToolGatewayPanel T23.9（C04 同源订正）", () => {
  it("shows a note because Hermes has no tool_gateway.* config key", async () => {
    stubFetch({ fields: {}, category_order: [] });
    render(<ToolGatewayPanel />);
    expect(
      await screen.findByText("该功能在当前 Hermes 版本无对应配置项。"),
    ).toBeInTheDocument();
  });
});
