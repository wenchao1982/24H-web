import { describe, expect, it } from "vitest";
import {
  deserializeFlow,
  planExecution,
  serializeFlow,
  substituteNodeOutput,
  type Flow,
} from "./flow";

const flow: Flow = {
  nodes: [
    { id: "a", kind: "agent", label: "A", x: 0, y: 0, prompt: "研究 {{node.output}}" },
    { id: "b", kind: "agent", label: "B", x: 100, y: 0, prompt: "基于 {{a.output}} 写摘要" },
  ],
  edges: [
    { from: "a", to: "b", inject: true },
    { from: "a", to: "b", inject: true },
  ],
};

describe("orchestration flow (M21)", () => {
  it("substitutes node outputs and blanks missing", () => {
    expect(substituteNodeOutput("x={{a.output}} y={{missing.output}}", { a: "hi" })).toBe(
      "x=hi y=",
    );
  });

  it("plans execution injecting immediate upstream output", () => {
    const steps = planExecution(flow, { a: "OUT-A", b: "OUT-B" });
    expect(steps[0].resolved).toBe("研究 "); // 无入边 → node.output 为空
    expect(steps[1].resolved).toBe("基于 OUT-A 写摘要");
    expect(steps[1].inputs).toEqual(["a", "a"]);
  });

  it("round-trips through a spawn_tree snapshot", () => {
    const snapshot = serializeFlow(flow);
    expect(snapshot.subagents[1]).toMatchObject({ id: "b", deps: ["a", "a"] });
    const restored = deserializeFlow(snapshot);
    expect(restored.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(restored.nodes[1].prompt).toBe("基于 {{a.output}} 写摘要");
    expect(restored.edges).toHaveLength(2);
  });
});
