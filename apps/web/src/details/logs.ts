/** 日志面板数据规范化（宽松解析官方 `/api/logs`）。 */

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

/** 日志行：兼容 `[...]` / `{lines:[...]}` / `{logs:[...]}` / `{entries:[...]}`。 */
export function normalizeLogs(payload: unknown): string[] {
  if (typeof payload === "string") {
    return payload.split("\n").filter((line) => line.trim() !== "");
  }
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root.lines)
      ? root.lines
      : Array.isArray(root.logs)
        ? root.logs
        : Array.isArray(root.entries)
          ? root.entries
          : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    const line = readString(asRecord(item), "message", "line", "text", "msg");
    if (line) {
      out.push(line);
    }
  }
  return out;
}
