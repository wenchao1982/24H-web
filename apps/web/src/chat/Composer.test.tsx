/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Composer from "./Composer";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
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
