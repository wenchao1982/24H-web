/**
 * M16 T23.2 上下文引用（@）：`complete.path` 结果归一化 + 引用 token / 消息拼装。
 * 引用以 `@path` 内联，由 Hermes 侧展开；工作台只负责插入与透传。
 */

export interface PathSuggestion {
  /** 文件或目录路径。 */
  path: string;
  /** 是否为目录。 */
  isDir: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  const record = asRecord(payload);
  return (
    asArray(record.paths).length > 0
      ? asArray(record.paths)
      : asArray(record.completions).length > 0
        ? asArray(record.completions)
        : asArray(record.items).length > 0
          ? asArray(record.items)
          : asArray(record.suggestions)
  );
}

/** 容错解析 `complete.path` 结果：字符串 / `{path,is_dir}` / `{name,type}`。 */
export function normalizePathSuggestions(payload: unknown): PathSuggestion[] {
  const out: PathSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of pickList(payload)) {
    if (typeof item === "string") {
      const path = item.trim();
      if (path && !seen.has(path)) {
        seen.add(path);
        out.push({ path, isDir: false });
      }
      continue;
    }
    const entry = asRecord(item);
    const path = str(entry.path) ?? str(entry.name) ?? str(entry.entry) ?? str(entry.file);
    if (!path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    const type = (str(entry.type) ?? "").toLowerCase();
    const isDir =
      entry.is_dir === true ||
      entry.isDir === true ||
      entry.dir === true ||
      type === "dir" ||
      type === "directory" ||
      (typeof entry.name === "string" && entry.name.endsWith("/"));
    out.push({ path, isDir });
  }
  return out;
}

/** 引用 token：`@path`。 */
export function referenceToken(path: string): string {
  return `@${path}`;
}

/** 发送消息时把引用内联拼到文本前（`@path` 由 Hermes 展开）。 */
export function buildMessage(text: string, references: string[]): string {
  const parts = references.map(referenceToken).filter((token) => token !== "@");
  const trimmed = text.trim();
  if (trimmed) {
    parts.push(trimmed);
  }
  return parts.join(" ");
}
