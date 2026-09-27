/**
 * M16 T23.1 上下文文件：解析 `slash.exec {command:'/context'}` 与 `GET /api/hermes/config`
 * 两种来源，归一化为项目上下文文件列表（路径 + 加载状态）。字段以官方契约为准，缺失即降级。
 */

export interface ContextSource {
  /** 文件路径或名称，如 `AGENTS.md`。 */
  path: string;
  /** 是否已加载进本次会话。 */
  loaded: boolean;
  /** 可选补充说明（来源 / 状态文本）。 */
  detail?: string;
}

/** 官方约定的项目上下文文件名（用于空数据时仍展示候选）。 */
export const CONTEXT_FILE_CANDIDATES = [
  ".hermes.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SOUL.md",
  ".cursorrules",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readLoaded(source: Record<string, unknown>): boolean {
  const value = source.loaded ?? source.active ?? source.enabled ?? source.present;
  if (typeof value === "boolean") {
    return value;
  }
  const status = (str(source.status) ?? str(source.state) ?? "").toLowerCase();
  if (["loaded", "active", "ok", "present", "on", "true", "已加载"].includes(status)) {
    return true;
  }
  if (["missing", "not_found", "absent", "disabled", "off", "false", "未加载"].includes(status)) {
    return false;
  }
  return true;
}

/** 从任意来源中提取上下文文件数组（兼容多种字段名与嵌套）。 */
function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  const record = asRecord(payload);
  const nested = asRecord(record.context);
  return (
    asArray(record.context_files) ??
    asArray(record.sources) ??
    asArray(record.files) ??
    asArray(record.contexts) ??
    asArray(record.items) ??
    asArray(nested.files) ??
    asArray(nested.sources) ??
    []
  );
}

/** 容错解析上下文文件列表；字符串项视为已加载文件。 */
export function normalizeContextSources(payload: unknown): ContextSource[] {
  const out: ContextSource[] = [];
  const seen = new Set<string>();
  for (const item of pickList(payload)) {
    if (typeof item === "string") {
      const path = item.trim();
      if (path && !seen.has(path)) {
        seen.add(path);
        out.push({ path, loaded: true });
      }
      continue;
    }
    const source = asRecord(item);
    const path = str(source.path) ?? str(source.file) ?? str(source.name) ?? str(source.source);
    if (!path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    const detail = str(source.detail) ?? str(source.kind) ?? str(source.origin);
    out.push({ path, loaded: readLoaded(source), ...(detail ? { detail } : {}) });
  }
  return out;
}

/** slash.exec 结果优先取结构化列表，字符串结果按行拆分为文件。 */
export function normalizeContextResult(payload: unknown): ContextSource[] {
  const list = normalizeContextSources(payload);
  if (list.length > 0) {
    return list;
  }
  const record = asRecord(payload);
  const text = str(record.text) ?? str(record.output) ?? str(record.message);
  if (!text) {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\s]+/, "").trim())
    .filter((line) => line !== "")
    .map((path) => ({ path, loaded: true }));
}
