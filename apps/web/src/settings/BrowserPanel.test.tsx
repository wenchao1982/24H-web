import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BrowserPanel from "./BrowserPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { browserParams, normalizeBrowserStatus } from "./browser";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <BrowserPanel />
    </GatewayProvider>,
  );
}

function impl(method: string, params: Record<string, unknown>): unknown {
  if (method === "browser.manage") {
    if (params.action === "connect") {
      return { connected: true, url: "about:blank" };
    }
    if (params.action === "disconnect") {
      return { connected: false };
    }
    return { status: "disconnected", engine: "chromium" };
  }
  return {};
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrowserPanel T18.5 浏览器控制", () => {
  it("reads status and connects via the gateway", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);

    expect(await screen.findByLabelText("浏览器状态")).toHaveTextContent("未连接");
    expect(screen.getByText("引擎：chromium")).toBeInTheDocument();
    expect(gateway.paramsOf("browser.manage")).toEqual([{ action: "status" }]);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "连接" }));

    await waitFor(() => {
      expect(gateway.paramsOf("browser.manage")).toContainEqual({ action: "connect" });
      expect(screen.getByLabelText("浏览器状态")).toHaveTextContent("已连接");
    });
  });

  it("disconnects when connected", async () => {
    const gateway = createFakeGateway((method, params) =>
      method === "browser.manage" ? { connected: params.action !== "disconnect" } : {},
    );
    renderPanel(gateway);
    await screen.findByLabelText("浏览器状态");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "断开" }));
    await waitFor(() => {
      expect(gateway.paramsOf("browser.manage")).toContainEqual({ action: "disconnect" });
    });
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeBrowserStatus(true)).toEqual({ connected: true });
    expect(normalizeBrowserStatus({ active: true, backend: "playwright" })).toEqual({
      connected: true,
      engine: "playwright",
    });
    expect(normalizeBrowserStatus({ status: "disconnected" })).toEqual({ connected: false });
    expect(browserParams("status")).toEqual({ action: "status" });
  });
});
