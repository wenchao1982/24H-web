/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentPicker from "./AgentPicker";
import { normalizeAgentOptions } from "./agentOptions";

const ME = { profiles: ["alpha", "beta"], default_profile: "alpha" };

describe("AgentPicker（REQ-002 / REQ-014）", () => {
  it("选项恒等于 me.profiles，且不含 profiles.list 的全量值", () => {
    const options = normalizeAgentOptions(ME);
    render(<AgentPicker options={options} value={null} variant="hero" onSelect={vi.fn()} />);

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "智能体",
      "alpha（默认）",
      "beta",
    ]);
    // profiles.list 的全量值（例如未分配给他人的 profile）绝不出现在选项里。
    expect(screen.queryByText("other-profile")).not.toBeInTheDocument();
  });

  it("hero 态可选择并回调（含 null 清空）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AgentPicker
        options={normalizeAgentOptions(ME)}
        value="alpha"
        variant="hero"
        onSelect={onSelect}
      />,
    );

    const select = screen.getByLabelText("智能体");
    expect(select).not.toBeDisabled();
    await user.selectOptions(select, "beta");
    expect(onSelect).toHaveBeenCalledWith("beta");

    await user.selectOptions(select, "");
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("docked 态只读并提示「切换将新建会话」", () => {
    render(
      <AgentPicker
        options={normalizeAgentOptions(ME)}
        value="alpha"
        variant="docked"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("智能体")).toBeDisabled();
    expect(screen.getByText("切换将新建会话")).toBeInTheDocument();
  });
});
