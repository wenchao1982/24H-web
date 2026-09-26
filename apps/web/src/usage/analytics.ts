/** 用量 / 系统统计规范化（宽松解析官方 `/api/analytics/*` 与 `/api/system/stats`）。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** 读取数字：兼容直接数值与 `{percent|usage|value}` 形态。 */
function readNumber(source: Record<string, unknown> | undefined, ...keys: string[]): number | null {
  if (!source) {
    return null;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (value && typeof value === "object") {
      const nested = asRecord(value);
      for (const inner of ["percent", "percentage", "usage", "value", "used", "used_percent"]) {
        const candidate = nested[inner];
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function readString(source: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!source) {
    return "";
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

export interface UsageSummary {
  sessions: number;
  messages: number;
  tokens: number;
  cost: number;
}

/** 会话/消息统计：兼容顶层与 `{totals}` 嵌套。 */
export function normalizeUsage(payload: unknown): UsageSummary {
  const root = asRecord(payload);
  const source = Object.keys(asRecord(root.totals)).length > 0 ? asRecord(root.totals) : root;
  return {
    sessions: readNumber(source, "sessions", "session_count", "total_sessions") ?? 0,
    messages: readNumber(source, "messages", "message_count", "total_messages") ?? 0,
    tokens: readNumber(source, "tokens", "total_tokens", "token_count") ?? 0,
    cost: readNumber(source, "cost", "total_cost", "cost_usd") ?? 0,
  };
}

export interface UsageByModel {
  model: string;
  tokens: number;
  cost: number;
  messages: number;
}

/** 按模型用量：兼容 `{models:[...]}` / `{by_model:...}` / 数组。 */
export function normalizeUsageByModel(payload: unknown): UsageByModel[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root.models)
      ? root.models
      : Array.isArray(root.by_model)
        ? root.by_model
        : [];
  const out: UsageByModel[] = [];
  for (const item of list) {
    const source = asRecord(item);
    const model = readString(source, "model", "name", "id");
    if (!model) {
      continue;
    }
    out.push({
      model,
      tokens: readNumber(source, "tokens", "total_tokens", "input_tokens") ?? 0,
      cost: readNumber(source, "cost", "total_cost", "cost_usd") ?? 0,
      messages: readNumber(source, "messages", "message_count", "requests") ?? 0,
    });
  }
  return out;
}

export interface SystemStats {
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  processes: number | null;
  health: string;
  uptime: number | null;
  version: string;
}

export function normalizeSystemStats(payload: unknown): SystemStats {
  const source = asRecord(payload);
  return {
    cpu: readNumber(source, "cpu", "cpu_usage", "cpu_percent"),
    memory: readNumber(source, "memory", "mem", "memory_usage", "mem_percent"),
    disk: readNumber(source, "disk", "disk_usage", "disk_percent"),
    processes: readNumber(source, "processes", "process_count", "processes_count"),
    health: readString(source, "health", "status", "state"),
    uptime: readNumber(source, "uptime", "uptime_seconds"),
    version: readString(source, "version", "hermes_version"),
  };
}
