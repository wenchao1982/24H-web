/** 文件面板数据规范化（宽松解析官方 `/api/files*`）。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return "";
}

function readNumber(source: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number | null;
}

/** 文件列表：兼容 `[...]` / `{files:[...]}` / `{entries:[...]}`。 */
export function normalizeFileList(payload: unknown): FileEntry[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root.files)
      ? root.files
      : Array.isArray(root.entries)
        ? root.entries
        : [];
  const out: FileEntry[] = [];
  for (const item of list) {
    const source = asRecord(item);
    const name = readString(source, "name", "path", "filename");
    const path = readString(source, "path", "name", "filename");
    if (!name && !path) {
      continue;
    }
    const type = readString(source, "type", "kind");
    const isDir =
      source.is_dir === true ||
      source.isDir === true ||
      source.dir === true ||
      source.is_directory === true ||
      type === "dir" ||
      type === "directory";
    out.push({ name: name || path, path: path || name, isDir, size: readNumber(source, "size", "bytes") });
  }
  return out;
}

/** 文件内容：兼容纯字符串与 `{content|text|data}`。 */
export function normalizeFileContent(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  const source = asRecord(payload);
  return readString(source, "content", "text", "data");
}
