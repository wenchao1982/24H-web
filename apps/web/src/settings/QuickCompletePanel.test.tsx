import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickCompletePanel from "./QuickCompletePanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { normalizeOneshot, oneshotParams } from "./oneshot";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <QuickCompletePanel />
    </GatewayProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("QuickCompletePanel T18.9 单次补全", () => {
  it("completes via llm.oneshot with the model", async () => {
    const gateway = createFakeGateway((method) =>
      method === "llm.oneshot" ? { text: "补全结果" } : {},
    );
    renderPanel(gateway);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("模型（可选）"), "gpt-4o-mini");
    await user.type(screen.getByLabelText("提示词"), "写一句问候");
    await user.click(screen.getByRole("button", { name: "补全" }));

    await waitFor(() => {
      expect(gateway.paramsOf("llm.oneshot")).toEqual([
        { prompt: "写一句问候", model: "gpt-4o-mini" },
      ]);
    });
    expect(await screen.findByText("补全结果")).toBeInTheDocument();
  });

  it("normalizes parameters and results", () => {
    expect(oneshotParams("hi")).toEqual({ prompt: "hi" });
    expect(oneshotParams("hi", "  ")).toEqual({ prompt: "hi" });
    expect(normalizeOneshot("done")).toBe("done");
    expect(normalizeOneshot({ completion: "ok" })).toBe("ok");
  });
});
