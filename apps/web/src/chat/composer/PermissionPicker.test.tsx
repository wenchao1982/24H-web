/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PermissionPicker from "./PermissionPicker";

describe("PermissionPicker（REQ-013）", () => {
  it("至少含默认与自动批准两个选项", () => {
    render(<PermissionPicker value="off" onSelect={vi.fn()} />);
    const select = screen.getByLabelText("权限模式");
    expect(select).toHaveValue("off");
    expect(screen.getByRole("option", { name: "默认" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "自动批准" })).toBeInTheDocument();
  });

  it("选「默认」回调 value=off（不开 yolo）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PermissionPicker value="on" onSelect={onSelect} />);

    await user.selectOptions(screen.getByLabelText("权限模式"), "off");
    expect(onSelect).toHaveBeenCalledWith("off");
  });

  it("选「自动批准」回调 value=on（开 yolo）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PermissionPicker value="off" onSelect={onSelect} />);

    await user.selectOptions(screen.getByLabelText("权限模式"), "on");
    expect(onSelect).toHaveBeenCalledWith("on");
  });

  it("不产生 \"default\" 取值（否则网关会翻转 yolo）", () => {
    render(<PermissionPicker value="off" onSelect={vi.fn()} />);
    const select = screen.getByLabelText("权限模式") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).not.toContain("default");
  });

  it("disabled 时禁用", () => {
    render(<PermissionPicker value="off" disabled onSelect={vi.fn()} />);
    expect(screen.getByLabelText("权限模式")).toBeDisabled();
  });
});
