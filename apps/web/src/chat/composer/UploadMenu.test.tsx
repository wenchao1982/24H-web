/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadMenu, { type UploadPanelKind } from "./UploadMenu";

function renderMenu() {
  const onAttachFiles = vi.fn();
  const onOpenPanel = vi.fn<(kind: UploadPanelKind) => void>();
  const result = render(
    <UploadMenu onAttachFiles={onAttachFiles} onOpenPanel={onOpenPanel} />,
  );
  return { onAttachFiles, onOpenPanel, ...result };
}

describe("UploadMenu（REQ-005 / REQ-007 / REQ-016）", () => {
  it("＋ 菜单打开后 8 项存在，含文件/图片/PDF 与五个面板入口", async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "添加附件" }));

    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual([
      "文件",
      "图片",
      "PDF",
      "子代理",
      "命令",
      "上下文",
      "人格",
      "图片生成",
    ]);
  });

  it("文件选择按钮可聚焦（WCAG 2.5.7），隐藏 input 用 visually-hidden", async () => {
    const user = userEvent.setup();
    const { container } = renderMenu();
    await user.click(screen.getByRole("button", { name: "添加附件" }));

    const imageItem = screen.getByRole("menuitem", { name: "图片" });
    imageItem.focus();
    expect(document.activeElement).toBe(imageItem);
    expect(imageItem).not.toBeDisabled();

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      expect(input).toHaveClass("visually-hidden");
    }
    expect(inputs[1]).toHaveAttribute("accept", "image/*");
    expect(inputs[2]).toHaveAttribute("accept", "application/pdf");
  });

  it("后五项调用 onOpenPanel(kind)", async () => {
    const user = userEvent.setup();
    const { onOpenPanel } = renderMenu();
    await user.click(screen.getByRole("button", { name: "添加附件" }));

    await user.click(screen.getByRole("menuitem", { name: "图片生成" }));
    expect(onOpenPanel).toHaveBeenCalledWith("image");
  });

  it("图片通道选择文件后把 File[] 交回调用方（无 RPC 由本组件发出）", async () => {
    const user = userEvent.setup();
    const { container, onAttachFiles } = renderMenu();
    await user.click(screen.getByRole("button", { name: "添加附件" }));

    const imageInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    const file = new File(["x"], "pic.png", { type: "image/png" });
    await user.upload(imageInput, file);

    expect(onAttachFiles).toHaveBeenCalledTimes(1);
    expect(onAttachFiles.mock.calls[0][0]).toEqual([file]);
  });

  it("disabled 时菜单不可打开", async () => {
    const user = userEvent.setup();
    render(<UploadMenu onAttachFiles={vi.fn()} onOpenPanel={vi.fn()} disabled />);
    await user.click(screen.getByRole("button", { name: "添加附件" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
