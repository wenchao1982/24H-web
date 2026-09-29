/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MenuButton from "./MenuButton";

function renderMenu() {
  return render(
    <MenuButton label="操作" trigger="⋯">
      {(close) => (
        <>
          <button type="button" role="menuitem" onClick={close}>
            一
          </button>
          <button type="button" role="menuitem" onClick={close}>
            二
          </button>
          <button type="button" role="menuitem" onClick={close}>
            三
          </button>
        </>
      )}
    </MenuButton>,
  );
}

describe("MenuButton（WAI-ARIA APG Menu Button）", () => {
  it("打开后 aria-expanded=true，菜单与子项角色正确", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "操作" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item).toHaveAttribute("role", "menuitem");
    }
  });

  it("Esc 关闭菜单并把焦点归还触发元素", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "操作" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("ArrowDown 打开并聚焦首项，菜单内循环导航", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "操作" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[items.length - 1]);

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(items[0]);

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("点击菜单项调用 close 关闭菜单", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MenuButton label="操作" trigger="⋯">
        {(close) => (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClick();
              close();
            }}
          >
            执行
          </button>
        )}
      </MenuButton>,
    );

    await user.click(screen.getByRole("button", { name: "操作" }));
    await user.click(screen.getByRole("menuitem", { name: "执行" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("disabled 时不打开菜单", async () => {
    const user = userEvent.setup();
    render(
      <MenuButton label="操作" trigger="⋯" disabled>
        {() => <button type="button" role="menuitem">一</button>}
      </MenuButton>,
    );

    await user.click(screen.getByRole("button", { name: "操作" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
