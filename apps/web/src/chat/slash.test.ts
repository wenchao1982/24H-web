import { describe, expect, it } from "vitest";
import { filterCommands, normalizeCatalog, parseSlash, slashResultText } from "./slash";

describe("slash T20.1 命令解析", () => {
  it("normalizes catalog from array and wrapped shapes", () => {
    expect(normalizeCatalog([{ name: "/goal", description: "目标" }])).toEqual([
      { name: "goal", description: "目标" },
    ]);
    expect(normalizeCatalog({ commands: [{ command: "plan", help: "计划" }] })).toEqual([
      { name: "plan", description: "计划" },
    ]);
    expect(normalizeCatalog({ items: [{ id: "review", usage: "<范围>" }] })).toEqual([
      { name: "review", description: "", argsHint: "<范围>" },
    ]);
    expect(normalizeCatalog(null)).toEqual([]);
  });

  it("filters commands by name/description", () => {
    const commands = [
      { name: "goal", description: "持久目标" },
      { name: "review", description: "代码评审" },
    ];
    expect(filterCommands(commands, "/go").map((c) => c.name)).toEqual(["goal"]);
    expect(filterCommands(commands, "评审").map((c) => c.name)).toEqual(["review"]);
    expect(filterCommands(commands, "")).toHaveLength(2);
  });

  it("parses /name args and extracts result text", () => {
    expect(parseSlash("/goal set 完成 M15")).toEqual({ command: "/goal", args: "set 完成 M15" });
    expect(parseSlash("/status")).toEqual({ command: "/status", args: "" });
    expect(parseSlash("普通消息")).toBeNull();
    expect(parseSlash("/")).toBeNull();
    expect(slashResultText({ message: "已设置" })).toBe("已设置");
    expect(slashResultText("纯文本")).toBe("纯文本");
  });
});
