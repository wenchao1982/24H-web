/**
 * 设置 → 高级 → 学习/策展：L2 `/api/curator` 与 `/api/learning/graph` 解析。
 *
 * 字段以官方契约为准，缺失即降级。
 */

export interface CuratorItem {
  title: string;
  kind?: string;
  summary?: string;
  at?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  kind?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface LearningGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function pickList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
}

/** 容错解析 `GET /api/curator`。 */
export function normalizeCurator(payload: unknown): CuratorItem[] {
  return pickList(payload, ["items", "lessons", "curator", "entries"]).flatMap(
    (entry): CuratorItem[] => {
      if (typeof entry === "string") {
        return [{ title: entry }];
      }
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const record = entry as Record<string, unknown>;
      const title = str(record.title) ?? str(record.name) ?? str(record.lesson) ?? str(record.id);
      if (!title) {
        return [];
      }
      return [
        {
          title,
          kind: str(record.kind) ?? str(record.type) ?? str(record.category),
          summary: str(record.summary) ?? str(record.description) ?? str(record.text),
          at: str(record.created_at) ?? str(record.at) ?? str(record.date),
        },
      ];
    },
  );
}

/** 容错解析 `GET /api/learning/graph`。 */
export function normalizeGraph(payload: unknown): LearningGraph {
  const nodeList = pickList(payload, ["nodes", "items"]);
  const edgeList =
    payload && typeof payload === "object"
      ? pickList((payload as Record<string, unknown>).edges, ["edges"])
      : [];
  const nodes = nodeList.flatMap((entry): GraphNode[] => {
    if (typeof entry === "string") {
      return [{ id: entry, label: entry }];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const id = str(record.id) ?? str(record.name) ?? str(record.label);
    if (!id) {
      return [];
    }
    return [{ id, label: str(record.label) ?? str(record.name) ?? id, kind: str(record.kind) ?? str(record.type) }];
  });
  const edges = edgeList.flatMap((entry): GraphEdge[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const from = str(record.from) ?? str(record.source) ?? str(record.src);
    const to = str(record.to) ?? str(record.target) ?? str(record.dst);
    return from && to ? [{ from, to, label: str(record.label) ?? str(record.relation) }] : [];
  });
  return { nodes, edges };
}
