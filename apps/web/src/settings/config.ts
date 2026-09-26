/** 设置 → 配置中心：常用 config.yaml 字段的扁平读写工具。 */

export interface CommonField {
  path: string;
  label: string;
  type: "boolean" | "string";
}

/** 常用且安全的配置字段（布尔开关）。 */
export const COMMON_FIELDS: CommonField[] = [
  { path: "api_server.enabled", label: "API Server", type: "boolean" },
  { path: "tool_search.enabled", label: "工具搜索", type: "boolean" },
  { path: "lsp.enabled", label: "LSP", type: "boolean" },
  { path: "deliverable.enabled", label: "Deliverable 模式", type: "boolean" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** 兼容 `{ config: {...} }` 与直接返回配置对象两种形态。 */
export function normalizeConfig(payload: unknown): Record<string, unknown> {
  const raw = asRecord(payload);
  const nested = asRecord(raw.config);
  return Object.keys(nested).length > 0 ? nested : raw;
}

/** 读取扁平路径的值。 */
export function readPath(config: Record<string, unknown>, path: string): unknown {
  let cursor: unknown = config;
  for (const segment of path.split(".")) {
    if (!cursor || typeof cursor !== "object") {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** 把扁平路径 → 值合并成嵌套对象（用于 PUT 增量）。 */
export function buildPatch(changes: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(changes)) {
    const segments = path.split(".");
    let cursor = out;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      const next = cursor[segment];
      if (!next || typeof next !== "object") {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = value;
  }
  return out;
}
