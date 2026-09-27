/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ContextFilesPanel from "./ContextFilesPanel";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { normalizeContextResult, normalizeContextSources } from "./contextFiles";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <ContextFilesPanel />
    </GatewayProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ContextFilesPanel T23.1 上下文文件", () => {
  it("renders sources from slash.exec /context with loaded status", async () => {
    const gateway = createFakeGateway((method) =>
      method === "slash.exec"
        ? {
            context_files: [
              { path: "AGENTS.md", loaded: true },
              { path: ".hermes.md", loaded: false },
            ],
          }
        : {},
    );
    renderPanel(gateway);

    expect(await screen.findByText("AGENTS.md")).toBeInTheDocument();
    expect(screen.getByLabelText("AGENTS.md 的加载状态")).toHaveTextContent("已加载");
    expect(screen.getByLabelText(".hermes.md 的加载状态")).toHaveTextContent("未加载");
    expect(gateway.paramsOf("slash.exec")).toEqual([{ command: "/context", args: "" }]);
  });

  it("falls back to GET /api/hermes/config when slash.exec fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ config: { context_files: ["SOUL.md"] } }),
      })) as unknown as typeof fetch,
    );
    const gateway = createFakeGateway(() => {
      throw new Error("slash unavailable");
    });
    renderPanel(gateway);

    expect(await screen.findByText("SOUL.md")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is returned", async () => {
    const gateway = createFakeGateway(() => ({}));
    renderPanel(gateway);
    expect(await screen.findByText("未发现项目上下文文件。")).toBeInTheDocument();
  });
});

describe("contextFiles normalizers", () => {
  it("normalizes strings, objects and status text", () => {
    expect(normalizeContextSources(["AGENTS.md", { path: ".hermes.md", status: "missing" }])).toEqual([
      { path: "AGENTS.md", loaded: true },
      { path: ".hermes.md", loaded: false },
    ]);
    expect(normalizeContextSources({ context: { sources: ["CLAUDE.md"] } })).toEqual([
      { path: "CLAUDE.md", loaded: true },
    ]);
    expect(normalizeContextResult({ text: "- AGENTS.md\n- SOUL.md" })).toEqual([
      { path: "AGENTS.md", loaded: true },
      { path: "SOUL.md", loaded: true },
    ]);
  });
});
