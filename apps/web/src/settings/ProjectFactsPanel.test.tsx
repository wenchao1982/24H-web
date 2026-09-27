import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProjectFactsPanel from "./ProjectFactsPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { normalizeFacts, normalizeVerification } from "./projectFacts";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <ProjectFactsPanel />
    </GatewayProvider>,
  );
}

function impl(method: string): unknown {
  if (method === "project.facts") {
    return { name: "24h-web", languages: ["TypeScript", "React"], monorepo: true };
  }
  if (method === "verification.status") {
    return { status: "passing", checks: [{ name: "typecheck", status: "ok" }] };
  }
  return {};
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectFactsPanel T18.10 项目事实/校验", () => {
  it("renders facts and verification from the gateway", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);

    expect(await screen.findByText("name")).toBeInTheDocument();
    expect(screen.getByText("24h-web")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByLabelText("校验结果")).toHaveTextContent("passing");
    expect(screen.getByText("typecheck")).toBeInTheDocument();
    expect(gateway.paramsOf("project.facts")).toEqual([{}]);
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeFacts([{ key: "a", value: 1 }])).toEqual([{ key: "a", value: "1" }]);
    expect(normalizeFacts({ facts: { b: "x" } })).toEqual([{ key: "b", value: "x" }]);
    expect(normalizeVerification({ ok: false })).toEqual({ state: "failed", checks: [] });
    expect(normalizeVerification(null)).toBeNull();
  });
});
