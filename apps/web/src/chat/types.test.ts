import { describe, expect, it } from "vitest";
import {
  appendInterruptedNotice,
  settleTools,
  turnStatus,
  type ToolStatus,
  type TranscriptItem,
} from "./types";

function tool(
  id: string,
  status: ToolStatus,
  extra: Partial<{ detail: string; result: string }> = {},
): TranscriptItem {
  return { kind: "tool", id, name: "web_search", status, ...extra };
}

describe("turnStatus REQ-002/P4 归一化", () => {
  it("maps known statuses and defaults unknown/missing to complete", () => {
    expect(turnStatus({ status: "interrupted" })).toBe("interrupted");
    expect(turnStatus({ status: "error" })).toBe("error");
    expect(turnStatus({ status: "complete" })).toBe("complete");
    expect(turnStatus({})).toBe("complete");
    expect(turnStatus({ status: "" })).toBe("complete");
    expect(turnStatus({ status: "settled" })).toBe("complete");
  });
});

describe("settleTools REQ-003 结算悬挂工具卡", () => {
  it("settles start/generating to interrupted, keeps complete and fields", () => {
    const items: TranscriptItem[] = [
      tool("t1", "start", { detail: "开始" }),
      tool("t2", "generating", { detail: "进行中" }),
      tool("t3", "complete", { result: "结果" }),
    ];
    const settled = settleTools(items, "interrupted");
    expect(settled).toHaveLength(items.length);
    expect(settled[0]).toMatchObject({ kind: "tool", status: "interrupted", detail: "开始" });
    expect(settled[1]).toMatchObject({ kind: "tool", status: "interrupted", detail: "进行中" });
    expect(settled[2]).toMatchObject({ kind: "tool", status: "complete", result: "结果" });
  });

  it("settles to complete when asked and leaves non-tool items untouched", () => {
    const items: TranscriptItem[] = [
      { kind: "message", id: "m1", role: "assistant", text: "hi", streaming: true },
      tool("t1", "generating"),
    ];
    const settled = settleTools(items, "complete");
    expect(settled[0]).toEqual(items[0]);
    expect(settled[1]).toMatchObject({ status: "complete" });
  });

  it("returns an array of equal length when there are no tool cards", () => {
    const items: TranscriptItem[] = [
      { kind: "message", id: "m1", role: "user", text: "hi" },
    ];
    expect(settleTools(items, "interrupted")).toHaveLength(1);
  });
});

describe("appendInterruptedNotice P1 幂等", () => {
  it("appends one notice to an empty transcript", () => {
    const next = appendInterruptedNotice([], "n1");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ kind: "notice", level: "interrupted", text: "已中断" });
  });

  it("returns items unchanged when the last item is already an interrupted notice", () => {
    const items: TranscriptItem[] = [
      { kind: "notice", id: "n1", level: "interrupted", text: "已中断" },
    ];
    expect(appendInterruptedNotice(items, "n2")).toBe(items);
  });

  it("still appends when the last item is a differently-leveled notice", () => {
    const items: TranscriptItem[] = [
      { kind: "notice", id: "n0", level: "error", text: "出错了" },
    ];
    expect(appendInterruptedNotice(items, "n1")).toHaveLength(2);
  });
});
