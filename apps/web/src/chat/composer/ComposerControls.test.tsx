/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComposerControls from "./ComposerControls";
import type { ModelOption } from "./modelCatalog";

const MODELS: ModelOption[] = [
  { id: "m-a", provider: "p1", label: "Model A", capabilities: {}, authenticated: true },
];

function renderControls(variant: "hero" | "docked", overrides: Record<string, unknown> = {}) {
  const props = {
    variant,
    agentOptions: [{ name: "alpha", isDefault: true }],
    agentValue: "alpha",
    onSelectAgent: vi.fn(),
    workspaceOptions: ["/home/u/a"],
    workspaceValue: null,
    onSelectWorkspace: vi.fn(),
    modelOptions: MODELS,
    modelValue: "m-a",
    modelCurrent: { model: "m-a", provider: "p1" },
    modelSwitch: { status: "idle" as const },
    onSelectModel: vi.fn(),
    onConfirmModel: vi.fn(),
    onCancelModelConfirm: vi.fn(),
    permissionValue: "default",
    onSelectPermission: vi.fn(),
    onAttachFiles: vi.fn(),
    onOpenPanel: vi.fn(),
    ...overrides,
  };
  return render(<ComposerControls {...props} />);
}

const BOTTOM_ORDER = [
  "upload-menu",
  "permission-picker",
  "composer-spacer",
  "model-picker",
  "composer-send",
];

function bottomOrder(container: HTMLElement): string[] {
  const row = container.querySelector(".composer-bottom-row");
  if (!row) {
    return [];
  }
  return Array.from(row.children).map((child) => {
    const el = child as HTMLElement;
    for (const candidate of [
      "upload-menu",
      "permission-picker",
      "composer-spacer",
      "model-picker",
      "composer-send",
      "composer-stop",
    ]) {
      if (el.classList.contains(candidate)) {
        return candidate;
      }
    }
    return "unknown";
  });
}

describe("ComposerControls（REQ-002 / REQ-003）", () => {
  it("docked：无 pill 行，底行 DOM 集合精确匹配", () => {
    const { container } = renderControls("docked");

    expect(container.querySelector(".chat-hero-pills")).toBeNull();
    expect(bottomOrder(container)).toEqual(BOTTOM_ORDER);
    expect(container.querySelector(".composer-bottom-row .model-picker")).not.toBeNull();
  });

  it("hero：pill 行含 智能体 · 工作区 · 模型，且仍有底行", () => {
    const { container } = renderControls("hero");

    const pills = container.querySelector(".chat-hero-pills");
    expect(pills).not.toBeNull();
    expect(pills?.querySelector(".agent-picker")).not.toBeNull();
    expect(pills?.querySelector(".workspace-picker")).not.toBeNull();
    expect(pills?.querySelector(".model-picker")).not.toBeNull();
    expect(bottomOrder(container)).toEqual(BOTTOM_ORDER);
  });

  it("不渲染语音与 git 分支 pill", () => {
    for (const variant of ["hero", "docked"] as const) {
      const { container, unmount } = renderControls(variant);
      expect(container.querySelector(".voice-live")).toBeNull();
      expect(container.querySelector('[class*="voice"]')).toBeNull();
      expect(container.querySelector(".composer-branch")).toBeNull();
      expect(container.querySelector('[data-branch]')).toBeNull();
      expect(screen.queryByLabelText("语音")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("running 时主操作切为停止", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const { container } = renderControls("docked", { running: true, onStop });

    expect(container.querySelector(".composer-send")).toBeNull();
    const stop = screen.getByRole("button", { name: "停止" });
    expect(stop).toHaveClass("composer-stop");
    await user.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("发送禁用由 canSend 控制", () => {
    renderControls("docked", { canSend: false });
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });
});
