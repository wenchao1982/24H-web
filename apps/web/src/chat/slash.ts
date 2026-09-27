/**
 * M15 会话命令（Slash）：`commands.catalog` / `complete.slash` 的容错解析 + `/name args` 解析。
 *
 * 字段以官方契约为准，缺失即降级；`slash.exec` 统一承载命令执行。
 */

export interface SlashCommand {
  /** 不含前导 `/` 的命令名，如 `goal`。 */
  name: string;
  description: string;
  argsHint?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function arr(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function pickName(entry: Record<string, unknown>): string | undefined {
  const raw = str(entry.name) ?? str(entry.command) ?? str(entry.id) ?? str(entry.slash);
  return raw?.replace(/^\//, "");
}

/** `commands.catalog` 的容错解析：支持数组 / `{commands}` / `{items}` / `{slash}`。 */
export function normalizeCatalog(payload: unknown): SlashCommand[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).commands ??
        (payload as Record<string, unknown>).items ??
        (payload as Record<string, unknown>).slash ??
        [])
      : [];
  return arr(raw).flatMap((entry): SlashCommand[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const name = pickName(entry);
    if (!name) {
      return [];
    }
    const command: SlashCommand = {
      name,
      description: str(entry.description) ?? str(entry.help) ?? str(entry.summary) ?? "",
    };
    const argsHint = str(entry.args) ?? str(entry.args_hint) ?? str(entry.usage);
    if (argsHint) {
      command.argsHint = argsHint;
    }
    return [command];
  });
}

/** `complete.slash` 的容错解析；形状与 catalog 接近。 */
export function normalizeCompletions(payload: unknown): SlashCommand[] {
  const raw =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>).completions ??
        (payload as Record<string, unknown>).commands ??
        (payload as Record<string, unknown>).items ??
        payload)
      : payload;
  return normalizeCatalog(raw);
}

/** 按命令名（或描述）过滤，忽略前导 `/`，大小写不敏感。 */
export function filterCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const q = query.replace(/^\//, "").trim().toLowerCase();
  if (q === "") {
    return commands;
  }
  return commands.filter(
    (command) =>
      command.name.toLowerCase().includes(q) || command.description.toLowerCase().includes(q),
  );
}

export interface ParsedSlash {
  /** 含前导 `/`，如 `/goal`。 */
  command: string;
  args: string;
}

/** 解析 `/goal set 目标`；非 slash 输入返回 null。命令名允许字母、数字与连字符。 */
export function parseSlash(text: string): ParsedSlash | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const match = trimmed.slice(1).match(/^([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/);
  if (!match) {
    return null;
  }
  return { command: `/${match[1]}`, args: (match[2] ?? "").trim() };
}

/** 从 `slash.exec` 结果里提取可读文本（字符串 / `{text|message|result|output}`）。 */
export function slashResultText(result: unknown): string {
  if (result == null) {
    return "";
  }
  if (typeof result === "string") {
    return result;
  }
  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }
  if (typeof result === "object") {
    const record = result as Record<string, unknown>;
    const text = str(record.text) ?? str(record.message) ?? str(record.output);
    if (text) {
      return text;
    }
    const nested = record.result;
    if (typeof nested === "string") {
      return nested;
    }
    for (const value of Object.values(record)) {
      if (typeof value === "string" && value.trim() !== "") {
        return value;
      }
    }
  }
  return "";
}
