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

/** 结构化日志行（容错解析，无法识别的字段为空串）。 */
export interface LogEntry {
  raw: string;
  time: string;
  level: string;
  module: string;
  message: string;
}

const TIME_RE =
  /^\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;
const LEVEL_RE = /\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/i;
const BRACKET_RE = /\[([^\]]+)\]/;
const PREFIX_RE = /\b([a-zA-Z0-9_]+)\s*:/;

const LEVEL_ALIAS: Record<string, string> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  warning: "warn",
  error: "error",
  fatal: "error",
};

/**
 * 宽松解析单行日志：
 * - time：行首 `YYYY-MM-DD[ T]HH:mm:ss(.sss)?(Z|±HH:mm)?`；
 * - level：行首附近首个 `TRACE|DEBUG|INFO|WARN(ING)|ERROR|FATAL`（WARN/WARNING→warn，FATAL→error，TRACE→debug）；
 * - module：首个 `[...]` 内容，或首个 `name:` 前缀；
 * - message：移除已识别 time/level/module 后的剩余文本；全部无法识别时为整行。
 */
export function parseLogLine(raw: string): LogEntry {
  const line = typeof raw === "string" ? raw : String(raw ?? "");

  const timeMatch = TIME_RE.exec(line);
  const time = timeMatch ? timeMatch[1] : "";

  const levelMatch = LEVEL_RE.exec(line);
  const levelToken = levelMatch ? levelMatch[1] : "";
  const level = levelToken ? (LEVEL_ALIAS[levelToken.toLowerCase()] ?? "") : "";

  const body = time ? line.replace(time, " ") : line;
  const bracketMatch = BRACKET_RE.exec(body);
  const prefixMatch = bracketMatch ? null : PREFIX_RE.exec(body);
  const module = bracketMatch
    ? bracketMatch[1].trim()
    : prefixMatch
      ? prefixMatch[1]
      : "";

  let message = line;
  if (time) {
    message = message.replace(time, " ");
  }
  if (levelToken) {
    message = message.replace(levelToken, " ");
  }
  if (bracketMatch) {
    message = message.replace(bracketMatch[0], " ");
  } else if (prefixMatch) {
    message = message.replace(prefixMatch[0], " ");
  }
  message = message.trim();
  if (!message) {
    message = line;
  }

  return { raw: line, time, level, module, message };
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
