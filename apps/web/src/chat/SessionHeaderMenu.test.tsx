/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionHeaderMenu from "./SessionHeaderMenu";

describe("SessionHeaderMenu（REQ-004 / REQ-016）", () => {
  it("恰 5 项：连接 / 导入 / 导出 / 分享 / 重命名", async () => {
    const user = userEvent.setup();
    render(<SessionHeaderMenu />);

    await user.click(screen.getByRole("button", { name: "会话操作" }));

    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["连接", "导入", "导出", "分享", "重命名"]);
  });

  it("点击子项触发对应回调并关闭菜单", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(<SessionHeaderMenu onShare={onShare} />);

    await user.click(screen.getByRole("button", { name: "会话操作" }));
    await user.click(screen.getByRole("menuitem", { name: "分享" }));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Esc 关闭并归还焦点到触发元素", async () => {
    const user = userEvent.setup();
    render(<SessionHeaderMenu />);

    const trigger = screen.getByRole("button", { name: "会话操作" });
    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
