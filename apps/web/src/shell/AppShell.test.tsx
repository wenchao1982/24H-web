import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppShell from "./AppShell";
import { useDetails } from "./details-context";

function DetailsToggle() {
  const { open, toggle } = useDetails();
  return <button type="button" onClick={toggle}>{open ? "关闭详情面板" : "打开详情面板"}</button>;
}

describe("AppShell", () => {
  it("renders the primary and bottom navigation items", () => {
    render(<AppShell title="对话" />);

    for (const label of ["对话", "智能体", "群聊", "任务", "用量", "设置", "账户", "通知"]) {
      // 组标题与导航项可能同名（如「智能体」），断言至少存在一个。
      expect(screen.getAllByRole("button", { name: label }).length).toBeGreaterThan(0);
    }
  });

  it("toggles the sidebar into a 56px rail", async () => {
    const user = userEvent.setup();
    render(<AppShell title="对话" />);

    const sidebar = screen.getByRole("navigation", { name: "主导航" });
    expect(sidebar).toHaveAttribute("data-collapsed", "false");

    await user.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByRole("button", { name: "展开侧栏" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(sidebar).toHaveAttribute("data-collapsed", "false");
  });

  it("keeps the details panel closed by default and toggles it", async () => {
    const user = userEvent.setup();
    render(
      <AppShell title="对话">
        <DetailsToggle />
        <div>主区内容</div>
      </AppShell>,
    );

    expect(screen.queryByRole("complementary", { name: "详情面板" })).not.toBeInTheDocument();
    expect(screen.getByText("主区内容")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开详情面板" }));
    const panel = screen.getByRole("complementary", { name: "详情面板" });
    expect(panel).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "文件" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭详情面板" }));
    expect(screen.queryByRole("complementary", { name: "详情面板" })).not.toBeInTheDocument();
  });
});
