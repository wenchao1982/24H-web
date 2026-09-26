/** Cron 任务规范化（宽松解析官方 `/api/cron/jobs`）。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

function readBool(source: Record<string, unknown>, fallback: boolean, ...keys: string[]): boolean {
  for (const key of keys) {
    if (typeof source[key] === "boolean") {
      return source[key] as boolean;
    }
  }
  return fallback;
}

export interface CronJob {
  id: string;
  schedule: string;
  nextRun: string;
  lastStatus: string;
  enabled: boolean;
}

/** 列表响应兼容 `[...]` / `{jobs:[...]}`；字段兼容 snake_case 与 camelCase。 */
export function normalizeCronJobs(payload: unknown): CronJob[] {
  const raw = asRecord(payload);
  const list = Array.isArray(payload) ? payload : Array.isArray(raw.jobs) ? raw.jobs : [];
  const out: CronJob[] = [];
  for (const item of list) {
    const source = asRecord(item);
    const id = readString(source, "id", "name", "job_id");
    if (!id) {
      continue;
    }
    out.push({
      id,
      schedule: readString(source, "schedule", "cron", "interval", "expression"),
      nextRun: readString(source, "next_run", "nextRun", "next_run_at"),
      lastStatus: readString(source, "last_status", "lastStatus", "status"),
      enabled: readBool(source, true, "enabled", "active"),
    });
  }
  return out;
}
