import { describe, expect, it } from "vitest";
import { normalizeDelegation, normalizeFlow, substituteNodeOutput } from "./flow";

describe("substituteNodeOutput", () => {
  it("replaces per-node placeholders", () => {
    expect(
      substituteNodeOutput("A: {{n1.output}} | B: {{n2.output}}", { n1: "hello", n2: "world" }),
    ).toBe("A: hello | B: world");
  });

  it("replaces the current-node placeholder and empties missing outputs", () => {
    expect(substituteNodeOutput("{{node.output}}/{{n9.output}}", { node: "X" })).toBe("X/");
  });

  it("leaves text without placeholders intact", () => {
    expect(substituteNodeOutput("plain text", {})).toBe("plain text");
  });
});

describe("normalizeFlow", () => {
  it("keeps valid nodes and drops dangling edges", () => {
    const flow = normalizeFlow({
      nodes: [
        { id: "a", kind: "agent", label: "A", x: 1, y: 2 },
        { id: "b", kind: "decision", label: "B", x: 3, y: 4 },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "a", to: "missing" },
      ],
    });
    expect(flow.nodes).toHaveLength(2);
    expect(flow.edges).toEqual([{ from: "a", to: "b", inject: true }]);
  });

  it("returns an empty flow on garbage", () => {
    expect(normalizeFlow(null)).toEqual({ nodes: [], edges: [] });
  });
});

describe("normalizeDelegation", () => {
  it("normalizes active subagents and limits", () => {
    const tree = normalizeDelegation({
      active: [{ id: "s1", name: "研究员", status: "running", depth: 0 }],
      paused: false,
      max_spawn_depth: 3,
      max_concurrent_children: 8,
    });
    expect(tree.active[0]).toMatchObject({ id: "s1", name: "研究员", status: "running" });
    expect(tree.maxDepth).toBe(3);
    expect(tree.maxChildren).toBe(8);
  });

  it("tolerates garbage", () => {
    expect(normalizeDelegation(null).active).toEqual([]);
    expect(normalizeDelegation("nope").paused).toBe(false);
  });
});
