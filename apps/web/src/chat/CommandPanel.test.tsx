import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommandPanel from "./CommandPanel";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";

function renderPanel(impl?: Parameters<typeof createFakeGateway>[0]) {
  const gateway = createFakeGateway(impl ?? (() => ({ message: "已处理" })));
  render(
    <GatewayProvider gateway={gateway}>
      <CommandPanel />
    </GatewayProvider>,
  );
  return gateway;
}

describe("CommandPanel T20.2 持久目标", () => {
  it("sets a goal via /goal set with the typed target", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("目标内容"), "完成 M15");
    expect(screen.getByRole("button", { name: "设置目标" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "设置目标" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([
      { command: "/goal", args: "set 完成 M15" },
    ]);
    expect(await screen.findByLabelText("执行结果")).toHaveTextContent("已处理");
  });

  it("dispatches /subgoal status after switching command", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "subgoal");
    await user.click(screen.getByRole("button", { name: "查看状态" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([{ command: "/subgoal", args: "status" }]);
  });
});

describe("CommandPanel T20.3 循环/心跳", () => {
  it("starts a loop with the typed prompt and stops a heartbeat", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "loop");
    await user.type(screen.getByLabelText("循环提示词"), "巡检");
    await user.click(screen.getByRole("button", { name: "开始循环" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([{ command: "/loop", args: "start 巡检" }]);

    await user.selectOptions(screen.getByLabelText("选择命令"), "heartbeat");
    await user.click(screen.getByRole("button", { name: "停止" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([
      { command: "/loop", args: "start 巡检" },
      { command: "/heartbeat", args: "stop" },
    ]);
  });
});

describe("CommandPanel T20.4 计划", () => {
  it("runs /plan and shows the produced plan", async () => {
    const gateway = renderPanel(() => ({ message: "计划：1. 读取 2. 修改 3. 验证" }));
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "plan");
    await user.type(screen.getByLabelText("计划目标"), "实现 M15");
    await user.click(screen.getByRole("button", { name: "生成计划" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([{ command: "/plan", args: "run 实现 M15" }]);
    expect(await screen.findByLabelText("执行结果")).toHaveTextContent("计划：1. 读取 2. 修改 3. 验证");
  });
});

describe("CommandPanel T20.5 评审", () => {
  it("dispatches /review and shows the result", async () => {
    const gateway = renderPanel(() => ({ message: "评审完成：发现 0 个问题" }));
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "review");
    await user.click(screen.getByRole("button", { name: "发起评审" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([{ command: "/review", args: "run" }]);
    expect(await screen.findByLabelText("执行结果")).toHaveTextContent("评审完成");
  });
});

describe("CommandPanel T20.6 会话分支", () => {
  it("creates a branch and forks the session", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "branch");
    await user.type(screen.getByLabelText("分支名称"), "feature-x");
    await user.click(screen.getByRole("button", { name: "创建分支" }));
    expect(gateway.paramsOf("slash.exec")).toEqual([
      { command: "/branch", args: "create feature-x" },
    ]);

    await user.selectOptions(screen.getByLabelText("选择命令"), "fork");
    await user.type(screen.getByLabelText("分叉名称"), "fork-1");
    await user.click(screen.getByRole("button", { name: "创建分叉" }));
    expect(gateway.paramsOf("slash.exec")).toEqual([
      { command: "/branch", args: "create feature-x" },
      { command: "/fork", args: "run fork-1" },
    ]);
  });
});

describe("CommandPanel T20.7 撤销/重试", () => {
  it("dispatches /undo and /retry", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "undo");
    await user.click(screen.getByRole("button", { name: "撤销上一步" }));
    await user.selectOptions(screen.getByLabelText("选择命令"), "retry");
    await user.click(screen.getByRole("button", { name: "重试上一步" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([
      { command: "/undo", args: "run" },
      { command: "/retry", args: "run" },
    ]);
  });
});

describe("CommandPanel T20.8 文件回滚", () => {
  it("lists checkpoints and restores one", async () => {
    const gateway = renderPanel(() => ({ text: "cp1 2026-01-01" }));
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "rollback");
    await user.click(screen.getByRole("button", { name: "列出检查点" }));
    expect(await screen.findByLabelText("执行结果")).toHaveTextContent("cp1");

    await user.type(screen.getByLabelText("检查点 ID"), "cp1");
    await user.click(screen.getByRole("button", { name: "恢复检查点" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([
      { command: "/rollback", args: "list" },
      { command: "/rollback", args: "restore cp1" },
    ]);
  });
});

describe("CommandPanel T20.9 状态快照", () => {
  it("creates, restores and prunes snapshots", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("选择命令"), "snapshot");
    await user.click(screen.getByRole("button", { name: "创建快照" }));
    await user.type(screen.getByLabelText("快照 ID"), "snap-1");
    await user.click(screen.getByRole("button", { name: "恢复快照" }));
    await user.click(screen.getByRole("button", { name: "清理快照" }));

    expect(gateway.paramsOf("slash.exec")).toEqual([
      { command: "/snapshot", args: "create" },
      { command: "/snapshot", args: "restore snap-1" },
      { command: "/snapshot", args: "prune" },
    ]);
  });
});
