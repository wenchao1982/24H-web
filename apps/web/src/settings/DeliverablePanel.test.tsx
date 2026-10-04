/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DeliverablePanel from "./DeliverablePanel";

function stubFetch(schema: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      const path = String(url).split("?")[0];
      const body =
        method === "GET"
          ? path.endsWith("/config/schema")
            ? schema
            : { config: {} }
          : {};
      return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
    }) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeliverablePanel T23.13（C04 订正）", () => {
  it("shows a note because Hermes has no deliverable.* config key", async () => {
    stubFetch({ fields: {}, category_order: [] });
    render(<DeliverablePanel />);
    expect(
      await screen.findByText("该功能在当前 Hermes 版本无对应配置项。"),
    ).toBeInTheDocument();
  });
});
