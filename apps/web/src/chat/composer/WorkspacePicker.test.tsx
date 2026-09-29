/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkspacePicker from "./WorkspacePicker";

describe("WorkspacePicker（REQ-012）", () => {
  it("渲染空值选项「工作区」与目录列表，选择后回调 path", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <WorkspacePicker options={["/home/u/a", "/home/u/b"]} value={null} onSelect={onSelect} />,
    );

    const select = screen.getByLabelText("工作区");
    expect(screen.getByRole("option", { name: "工作区" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "/home/u/a" })).toBeInTheDocument();

    await user.selectOptions(select, "/home/u/b");
    expect(onSelect).toHaveBeenCalledWith("/home/u/b");
  });

  it("选择空值回调 null（清空 cwd）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<WorkspacePicker options={["/home/u/a"]} value="/home/u/a" onSelect={onSelect} />);

    await user.selectOptions(screen.getByLabelText("工作区"), "");
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("disabled 时禁用", () => {
    render(<WorkspacePicker options={[]} value={null} disabled onSelect={vi.fn()} />);
    expect(screen.getByLabelText("工作区")).toBeDisabled();
  });
});
