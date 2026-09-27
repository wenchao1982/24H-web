import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubagentsPanel from "./SubagentsPanel";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { normalizePaused, normalizeSubagents, normalizeTail } from "./subagents";

function renderPanel(gateway: FakeGateway, sessionId: string | null = "s1") {
  return render(
    <GatewayProvider gateway={gateway}>
      <SubagentsPanel sessionId={sessionId} />
    </GatewayProvider>,
  );
}

function impl(method: string): unknown {
  if (method === "subagent.list") {
    return {
      subagents: [{ id: "a1", name: "reviewer", status: "running", latest: "正在复核" }],
    };
  }
  if (method === "delegation.status") {
    return { paused: false };
  }
  if (method === "subagent.tail") {
    return { text: "第一行\n第二行" };
  }
  return {};
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SubagentsPanel T17.5 子代理观测", () => {
  it("renders live children and tails output from the gateway", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);

    const child = await screen.findByRole("button", { name: "查看子代理 reviewer 输出" });
    expect(child).toHaveTextContent("reviewer");
    expect(child).toHaveTextContent("running");
    expect(screen.getByText("正在复核")).toBeInTheDocument();
    expect(gateway.paramsOf("subagent.list")).toEqual([{ session_id: "s1" }]);

    const user = userEvent.setup();
    await user.click(child);
    expect(await screen.findByText(/第一行/)).toBeInTheDocument();
    expect(gateway.paramsOf("subagent.tail")).toEqual([{ subagent_id: "a1" }]);
  });

  it("interrupts a child via subagent.interrupt", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);
    await screen.findByRole("button", { name: "查看子代理 reviewer 输出" });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "中断" }));

    await waitFor(() => {
      expect(gateway.paramsOf("subagent.interrupt")).toEqual([{ subagent_id: "a1" }]);
    });
  });

  it("steers a child and pauses delegation", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);
    const child = await screen.findByRole("button", { name: "查看子代理 reviewer 输出" });

    const user = userEvent.setup();
    await user.click(child);
    await user.type(screen.getByLabelText("输入指令并指派"), "先检查测试");
    await user.click(screen.getByRole("button", { name: "指点" }));

    await waitFor(() => {
      expect(gateway.paramsOf("subagent.steer")).toEqual([
        { subagent_id: "a1", text: "先检查测试" },
      ]);
    });

    await user.click(screen.getByLabelText("暂停委派"));
    await waitFor(() => {
      expect(gateway.paramsOf("delegation.pause")).toEqual([{ paused: true }]);
    });
  });

  it("prompts for a session when none is selected", () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway, null);
    expect(screen.getByText("选择会话后查看子代理。")).toBeInTheDocument();
    expect(gateway.requests).toHaveLength(0);
  });
});

describe("subagent normalizers", () => {
  it("normalizes children, tail and pause state", () => {
    expect(normalizeSubagents({ children: [{ subagent_id: "x", label: "X", state: "done" }] })).toEqual([
      { id: "x", name: "X", status: "done", latest: "" },
    ]);
    expect(normalizeSubagents(null)).toEqual([]);
    expect(normalizeTail("raw")).toBe("raw");
    expect(normalizeTail({ output: "out" })).toBe("out");
    expect(normalizePaused({ status: "paused" })).toBe(true);
    expect(normalizePaused({ paused: false })).toBe(false);
  });
});
