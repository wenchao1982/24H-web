/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModelPicker, { type ModelSwitchState } from "./ModelPicker";
import type { ModelOption } from "./modelCatalog";

const OPTIONS: ModelOption[] = [
  { id: "m-a", provider: "p1", label: "Model A", capabilities: {}, authenticated: true },
  {
    id: "m-b",
    provider: "p1",
    label: "Model B",
    capabilities: { fast: true, reasoning: true },
    authenticated: true,
  },
];

function renderPicker(overrides: {
  value?: string | null;
  switchState?: ModelSwitchState;
  disabled?: boolean;
} = {}) {
  const onSelect = vi.fn();
  const onConfirm = vi.fn();
  const onCancelConfirm = vi.fn();
  const result = render(
    <ModelPicker
      options={OPTIONS}
      value={overrides.value ?? "m-a"}
      current={{ model: "m-a", provider: "p1" }}
      disabled={overrides.disabled}
      switchState={overrides.switchState ?? { status: "idle" }}
      onSelect={onSelect}
      onConfirm={onConfirm}
      onCancelConfirm={onCancelConfirm}
    />,
  );
  return { onSelect, onConfirm, onCancelConfirm, ...result };
}

describe("ModelPicker（REQ-009 / REQ-010 / REQ-011）", () => {
  it("渲染选项并回报选择", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    const select = screen.getByLabelText("模型");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Model A",
      "Model B",
    ]);

    await user.selectOptions(select, "m-b");
    expect(onSelect).toHaveBeenCalledWith("m-b");
  });

  it("capabilities.fast → 只读 Flash 徽标（不是按钮/不可点）", () => {
    renderPicker({ value: "m-b" });
    const badge = screen.getByText("Flash");
    expect(badge).toHaveClass("model-flash-badge");
    expect(badge.tagName).toBe("SPAN");
    expect(screen.queryByRole("button", { name: "Flash" })).not.toBeInTheDocument();
  });

  it("无 fast 能力时不渲染 Flash", () => {
    renderPicker({ value: "m-a" });
    expect(screen.queryByText("Flash")).not.toBeInTheDocument();
  });

  it("deferred 态渲染「将于下一回合生效」提示", () => {
    renderPicker({ switchState: { status: "deferred", target: "m-b" } });
    expect(screen.getByText("将于下一回合生效")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("confirm 态渲染 role=alertdialog 并回调确认/取消", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancelConfirm } = renderPicker({
      switchState: { status: "confirm", target: "m-b", message: "该模型较贵，确认切换？" },
    });

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("该模型较贵，确认切换？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancelConfirm).toHaveBeenCalledTimes(1);
  });

  it("error 态以 role=alert 透传网关 message", () => {
    renderPicker({ switchState: { status: "error", target: "m-b", message: "网关拒绝" } });
    expect(screen.getByRole("alert")).toHaveTextContent("网关拒绝");
  });

  it("disabled 时选择器禁用", () => {
    renderPicker({ disabled: true });
    expect(screen.getByLabelText("模型")).toBeDisabled();
  });
});
