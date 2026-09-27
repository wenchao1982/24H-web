import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppShell from "./AppShell";

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(narrow: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: narrow && query.includes("max-width: 900px"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  mockMatchMedia(false);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("AppShell 响应式（T13.2）", () => {
  it("窄屏进入抽屉模式：data-narrow / data-mobile，抽屉默认关闭", () => {
    mockMatchMedia(true);
    const { container } = render(<AppShell title="对话" />);

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-narrow", "true");
    const sidebar = screen.getByRole("navigation", { name: "主导航" });
    expect(sidebar).toHaveAttribute("data-mobile", "true");
    expect(sidebar).toHaveAttribute("data-drawer", "closed");
    expect(screen.getByRole("button", { name: "打开导航" })).toBeInTheDocument();
  });

  it("抽屉开关：打开后覆盖主区，点遮罩关闭", async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    render(<AppShell title="对话" />);

    const sidebar = screen.getByRole("navigation", { name: "主导航" });
    await user.click(screen.getByRole("button", { name: "打开导航" }));
    expect(sidebar).toHaveAttribute("data-drawer", "open");
    expect(screen.getByRole("button", { name: "关闭导航" })).toBeInTheDocument();

    const backdrop = document.querySelector(".sidebar-backdrop");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as HTMLElement);
    expect(sidebar).toHaveAttribute("data-drawer", "closed");
  });

  it("宽屏保持三栏：无抽屉，仍可折叠为 56px 轨道", async () => {
    const user = userEvent.setup();
    const { container } = render(<AppShell title="对话" />);

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-narrow", "false");
    expect(screen.queryByRole("button", { name: "打开导航" })).not.toBeInTheDocument();

    const sidebar = screen.getByRole("navigation", { name: "主导航" });
    expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await user.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(sidebar).toHaveAttribute("data-collapsed", "true");
  });
});
