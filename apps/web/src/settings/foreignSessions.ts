/**
 * 设置 → 高级 → 外部会话导入：L1 `session.foreign.*` 解析与参数。
 *
 * 字段以官方契约为准，缺失即降级。
 */

export interface ForeignSession {
  id: string;
  title: string;
  source?: string;
  updatedAt?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** 容错解析 `session.foreign.list`。 */
export function normalizeForeignSessions(payload: unknown): ForeignSession[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).sessions ??
        (payload as Record<string, unknown>).items ??
        (payload as Record<string, unknown>).foreign ??
        [])
      : [];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry): ForeignSession[] => {
    if (typeof entry === "string") {
      return [{ id: entry, title: entry }];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const id = str(record.id) ?? str(record.session_id) ?? str(record.path) ?? str(record.title);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        title: str(record.title) ?? str(record.name) ?? id,
        source: str(record.source) ?? str(record.agent) ?? str(record.origin),
        updatedAt: str(record.updated_at) ?? str(record.updatedAt) ?? str(record.mtime),
      },
    ];
  });
}

/** 容错解析 `session.foreign.preview` 为文本。 */
export function normalizeForeignPreview(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["preview", "text", "content", "messages", "output"]) {
      const value = record[key];
      if (typeof value === "string") {
        return value;
      }
    }
    return JSON.stringify(record, null, 2);
  }
  return "";
}

export function foreignParams(id: string): Record<string, unknown> {
  return { id };
}
