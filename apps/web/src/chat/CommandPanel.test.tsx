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
