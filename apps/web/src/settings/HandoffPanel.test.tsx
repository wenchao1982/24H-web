import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HandoffPanel from "./HandoffPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { handoffFailParams, normalizeHandoff } from "./handoff";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <HandoffPanel />
    </GatewayProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HandoffPanel T18.11 交接", () => {
  it("renders the handoff state and fails it with a reason", async () => {
    const gateway = createFakeGateway((method) =>
      method === "handoff.state" ? { status: "active", next_agent: "reviewer" } : {},
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel(gateway);

    expect(await screen.findByLabelText("交接状态")).toHaveTextContent("交接进行中");
    expect(screen.getByLabelText("交接状态")).toHaveTextContent("交给 reviewer");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("失败原因（可选）"), "依赖不可用");
    await user.click(screen.getByRole("button", { name: "标记失败" }));

    await waitFor(() => {
      expect(gateway.paramsOf("handoff.fail")).toEqual([{ reason: "依赖不可用" }]);
    });
  });

  it("disables fail when inactive and normalizes", async () => {
    const gateway = createFakeGateway(() => ({}));
    renderPanel(gateway);
    expect(await screen.findByRole("button", { name: "标记失败" })).toBeDisabled();
    expect(normalizeHandoff({ pending: true, to: "b" })).toEqual({ active: true, next: "b" });
    expect(normalizeHandoff(null)).toEqual({ active: false });
    expect(handoffFailParams(" ")).toEqual({});
  });
});
