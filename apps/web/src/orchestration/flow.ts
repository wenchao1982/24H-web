/**
 * 可视化编排（M21）纯函数层：画布模型、变量注入、委派树归一化。
 * 执行层复用 Hermes `spawn_tree.*` / `delegation.*` / `subagent.*`（不重写内核）。
 */

export type FlowKind = "agent" | "decision" | "tool";

export interface FlowNode {
  id: string;
  kind: FlowKind;
  label: string;
  x: number;
  y: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** 该边把上游输出注入下游（`{{node.output}}`）。 */
  inject: boolean;
}

export interface Flow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** 容错归一化画布（来自导入/本地）。 */
export function normalizeFlow(raw: unknown): Flow {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  if (!raw || typeof raw !== "object") {
    return { nodes, edges };
  }
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.nodes)) {
    for (const entry of record.nodes) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const node = entry as Record<string, unknown>;
      const id = str(node.id);
      if (!id) {
        continue;
      }
      const kindRaw = str(node.kind);
      const kind: FlowKind = kindRaw === "decision" || kindRaw === "tool" ? kindRaw : "agent";
      nodes.push({
        id,
        kind,
        label: str(node.label) ?? id,
        x: typeof node.x === "number" ? node.x : 40,
        y: typeof node.y === "number" ? node.y : 40,
      });
    }
  }
  const ids = new Set(nodes.map((node) => node.id));
  if (Array.isArray(record.edges)) {
    for (const entry of record.edges) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const edge = entry as Record<string, unknown>;
      const from = str(edge.from);
      const to = str(edge.to);
      if (!from || !to || !ids.has(from) || !ids.has(to)) {
        continue;
      }
      edges.push({ from, to, inject: edge.inject !== false });
    }
  }
  return { nodes, edges };
}

/**
 * 变量替换：`{{<nodeId>.output}}` 与 `{{node.output}}`（当前上游）→ 对应输出；
 * 缺失节点输出 → 替换为空串（对齐 §8.4「缺失 → 为空并告警」）。
 */
export function substituteNodeOutput(
  template: string,
  outputs: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([\w.-]+)\.output\s*\}\}/g, (_match, key: string) => {
    return outputs[key] ?? "";
  });
}

export interface SubagentNode {
  id: string;
  name: string;
  status: string;
  depth: number;
  parentId: string | null;
}

export interface DelegationTree {
  active: SubagentNode[];
  paused: boolean;
  maxDepth: number | null;
  maxChildren: number | null;
}

/** 容错归一化 `delegation.status`（`{active,paused,max_spawn_depth,max_concurrent_children}`）。 */
export function normalizeDelegation(raw: unknown): DelegationTree {
  const tree: DelegationTree = { active: [], paused: false, maxDepth: null, maxChildren: null };
  if (!raw || typeof raw !== "object") {
    return tree;
  }
  const record = raw as Record<string, unknown>;
  tree.paused = record.paused === true;
  tree.maxDepth = typeof record.max_spawn_depth === "number" ? record.max_spawn_depth : null;
  tree.maxChildren =
    typeof record.max_concurrent_children === "number" ? record.max_concurrent_children : null;
  if (Array.isArray(record.active)) {
    tree.active = record.active.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const node = entry as Record<string, unknown>;
      const id = str(node.id) ?? str(node.subagent_id);
      if (!id) {
        return [];
      }
      return [
        {
          id,
          name: str(node.name) ?? str(node.label) ?? id,
          status: str(node.status) ?? str(node.state) ?? "running",
          depth: typeof node.depth === "number" ? node.depth : 0,
          parentId: str(node.parent_id) ?? str(node.parent),
        },
      ];
    });
  }
  return tree;
}
