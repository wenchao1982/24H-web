/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PermissionPicker from "./PermissionPicker";

describe("PermissionPicker（REQ-013）", () => {
  it("至少含默认与自动批准两个选项", () => {
    render(<PermissionPicker value="default" onSelect={vi.fn()} />);
    const select = screen.getByLabelText("权限模式");
    expect(select).toHaveValue("default");
    expect(screen.getByRole("option", { name: "默认" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "自动批准" })).toBeInTheDocument();
  });

  it("选择自动批准回调对应模式值", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PermissionPicker value="default" onSelect={onSelect} />);

    await user.selectOptions(screen.getByLabelText("权限模式"), "on");
    expect(onSelect).toHaveBeenCalledWith("on");
  });

  it("disabled 时禁用", () => {
    render(<PermissionPicker value="default" disabled onSelect={vi.fn()} />);
    expect(screen.getByLabelText("权限模式")).toBeDisabled();
  });
});
