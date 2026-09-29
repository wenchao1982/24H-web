/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Composer from "./Composer";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import type { Attachment } from "./types";
import { buildMessage, normalizePathSuggestions, referenceToken } from "./references";

function renderComposer(gateway: FakeGateway, onSend: (text: string) => void = vi.fn()) {
  return render(
    <GatewayProvider gateway={gateway}>
      <Composer onSend={onSend} />
    </GatewayProvider>,
  );
}

const PATHS = {
  paths: [
    { path: "src/app.ts", is_dir: false },
    { path: "src/components", is_dir: true },
  ],
};

describe("Composer T23.2 上下文引用（@）", () => {
  it("opens the @ menu from complete.path and inserts a reference chip", async () => {
    const gateway = createFakeGateway((method) =>
      method === "complete.path" ? PATHS : {},
    );
    const onSend = vi.fn();
    renderComposer(gateway, onSend);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("消息"), "@");

    const option = await screen.findByRole("button", { name: "src/app.ts" });
    await waitFor(() => {
      expect(gateway.paramsOf("complete.path")).toEqual([{ prefix: "" }]);
    });
    await user.click(option);

    expect(screen.getByLabelText("移除引用 src/app.ts")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "src/app.ts" })).not.toBeInTheDocument();
  });

  it("includes inserted references in the sent message", async () => {
    const gateway = createFakeGateway((method) =>
      method === "complete.path" ? PATHS : {},
    );
    const onSend = vi.fn();
    renderComposer(gateway, onSend);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("消息"), "@src");
    await user.click(await screen.findByRole("button", { name: "src/components/" }));
    await user.type(screen.getByLabelText("消息"), "查看这个目录");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSend).toHaveBeenCalledWith("@src/components 查看这个目录");
    expect(screen.queryByLabelText("移除引用 src/components")).not.toBeInTheDocument();
  });
});

describe("reference helpers", () => {
  it("normalizes path suggestions and builds messages", () => {
    expect(normalizePathSuggestions(["a.ts", { name: "dir", type: "dir" }])).toEqual([
      { path: "a.ts", isDir: false },
      { path: "dir", isDir: true },
    ]);
    expect(referenceToken("src/a.ts")).toBe("@src/a.ts");
    expect(buildMessage("看这里", ["src/a.ts", "src/b.ts"])).toBe(
      "@src/a.ts @src/b.ts 看这里",
    );
    expect(buildMessage("", ["src/a.ts"])).toBe("@src/a.ts");
  });
});

function renderWithProps(props: Partial<React.ComponentProps<typeof Composer>>) {
  const gateway = createFakeGateway();
  return render(
    <GatewayProvider gateway={gateway}>
      <Composer onSend={vi.fn()} {...props} />
    </GatewayProvider>,
  );
}

const attachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: "a1",
  name: "notes.txt",
  size: 5,
  type: "text/plain",
  method: "file.attach",
  ...overrides,
});

describe("Composer TASK-015 双态与上传通道", () => {
  it("默认 docked，可切 hero（同一实例，仅 data-variant）", () => {
    const { container, rerender } = renderWithProps({});
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("data-variant", "docked");

    const gateway = createFakeGateway();
    rerender(
      <GatewayProvider gateway={gateway}>
        <Composer onSend={vi.fn()} variant="hero" />
      </GatewayProvider>,
    );
    expect(container.querySelector("form")).toHaveAttribute("data-variant", "hero");
  });

  it("拖拽 3 个文件 → onAttachFiles 收到 3 个（浏览器 File API）", () => {
    const onAttachFiles = vi.fn();
    const { container } = renderWithProps({ onAttachFiles });
    const form = container.querySelector("form");
    if (!form) {
      throw new Error("缺少 form");
    }
    const files = [
      new File(["a"], "a.txt", { type: "text/plain" }),
      new File(["b"], "b.txt", { type: "text/plain" }),
      new File(["c"], "c.txt", { type: "text/plain" }),
    ];

    fireEvent.dragOver(form, { dataTransfer: { files: [] } });
    expect(form).toHaveAttribute("data-dragover", "true");

    fireEvent.drop(form, { dataTransfer: { files } });

    expect(onAttachFiles).toHaveBeenCalledTimes(1);
    expect(onAttachFiles.mock.calls[0]?.[0]).toHaveLength(3);
    expect(form).toHaveAttribute("data-dragover", "false");
  });

  it("粘贴含图片的剪贴板 → onAttachFiles 收到该图片", () => {
    const onAttachFiles = vi.fn();
    renderWithProps({ onAttachFiles });
    const image = new File(["img"], "p.png", { type: "image/png" });

    fireEvent.paste(screen.getByLabelText("消息"), { clipboardData: { files: [image] } });

    expect(onAttachFiles).toHaveBeenCalledTimes(1);
    expect(onAttachFiles.mock.calls[0]?.[0]).toEqual([image]);
  });

  it("只有附件、无文本时发送按钮可用", () => {
    renderWithProps({ attachments: [attachment()] });
    expect(screen.getByRole("button", { name: "发送" })).toBeEnabled();
  });

  it("无文本、无引用、无附件时发送按钮禁用", () => {
    renderWithProps({});
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });

  it("attachmentCount 纳入发送守卫（controls 场景）", () => {
    renderWithProps({ attachmentCount: 1 });
    expect(screen.getByRole("button", { name: "发送" })).toBeEnabled();
  });
});
