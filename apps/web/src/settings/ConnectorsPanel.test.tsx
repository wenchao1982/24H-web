import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectorsPanel from "./ConnectorsPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import { normalizeConnectors } from "./vault";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ConnectorsPanel (C03：连接器独立于密钥库)", () => {
  it("lists connectors with status", async () => {
    const gateway = createFakeGateway((method) =>
      method === "connectors.list"
        ? { connectors: [{ name: "github", connected: true }] }
        : {},
    );
    render(
      <GatewayProvider gateway={gateway}>
        <ConnectorsPanel />
      </GatewayProvider>,
    );

    expect(await screen.findByText("github")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeConnectors([{ id: "slack", state: "disconnected" }])).toEqual([
      { name: "slack", status: "disconnected" },
    ]);
  });
});
