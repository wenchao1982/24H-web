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

/** 常用 cron 模板（label 用于按钮文案，expr 为标准 5 段表达式）。 */
export const CRON_TEMPLATES: { label: string; expr: string }[] = [
  { label: "每天早上 9 点", expr: "0 9 * * *" },
  { label: "每小时", expr: "0 * * * *" },
  { label: "每周一 9 点", expr: "0 9 * * 1" },
  { label: "每分钟（测试）", expr: "* * * * *" },
];

/**
 * 解析单个 cron 字段，返回允许取值集合；无法解析返回 null。
 * 支持 `*`、纯数字、步长「星号斜杠 n」、`a-b`、`a-b/n` 与逗号列表。
 */
function parseCronField(field: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();
  for (const raw of field.split(",")) {
    const token = raw.trim();
    if (token === "") {
      return null;
    }
    let step = 1;
    let range = token;
    const slash = token.indexOf("/");
    if (slash >= 0) {
      range = token.slice(0, slash);
      const stepText = token.slice(slash + 1);
      if (!/^\d+$/.test(stepText)) {
        return null;
      }
      step = Number(stepText);
      if (step < 1) {
        return null;
      }
    }
    let lo: number;
    let hi: number;
    if (range === "*") {
      lo = min;
      hi = max;
    } else if (/^\d+$/.test(range)) {
      lo = Number(range);
      hi = slash >= 0 ? max : lo;
    } else {
      const match = /^(\d+)-(\d+)$/.exec(range);
      if (!match) {
        return null;
      }
      lo = Number(match[1]);
      hi = Number(match[2]);
      if (lo > hi) {
        return null;
      }
    }
    if (lo < min || hi > max) {
      return null;
    }
    for (let value = lo; value <= hi; value += step) {
      values.add(value);
    }
  }
  return values.size > 0 ? values : null;
}

function cronDayMatches(
  date: Date,
  dom: Set<number>,
  dow: Set<number>,
  domRestricted: boolean,
  dowRestricted: boolean,
): boolean {
  const domOk = dom.has(date.getDate());
  const dowOk = dow.has(date.getDay());
  if (domRestricted && dowRestricted) {
    return domOk || dowOk;
  }
  if (domRestricted) {
    return domOk;
  }
  if (dowRestricted) {
    return dowOk;
  }
  return true;
}

/**
 * 计算标准 5 段 cron（`分 时 日 月 周`）的下一个匹配时刻。
 * 从 `from`（默认 now）之后的整分钟开始逐分钟查找，最多扫描 366 天；
 * 无法解析或超时返回 null。
 */
export function nextCronRun(expr: string, from: Date = new Date()): Date | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }
  const minutes = parseCronField(parts[0], 0, 59);
  const hours = parseCronField(parts[1], 0, 23);
  const dom = parseCronField(parts[2], 1, 31);
  const months = parseCronField(parts[3], 1, 12);
  const dowRaw = parseCronField(parts[4], 0, 7);
  if (!minutes || !hours || !dom || !months || !dowRaw) {
    return null;
  }
  const dow = new Set<number>();
  for (const value of dowRaw) {
    dow.add(value === 7 ? 0 : value);
  }
  const domRestricted = parts[2].trim() !== "*";
  const dowRestricted = parts[4].trim() !== "*";

  const current = new Date(from.getTime());
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i += 1) {
    if (
      months.has(current.getMonth() + 1) &&
      cronDayMatches(current, dom, dow, domRestricted, dowRestricted) &&
      hours.has(current.getHours()) &&
      minutes.has(current.getMinutes())
    ) {
      return new Date(current.getTime());
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  return null;
}

export interface DeliveryTarget {
  id: string;
  label: string;
  platform: string;
}

function pickList(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  const raw = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(raw[key])) {
      return raw[key] as unknown[];
    }
  }
  return [];
}

/** `GET /api/cron/delivery-targets`。 */
export function normalizeDeliveryTargets(payload: unknown): DeliveryTarget[] {
  return pickList(payload, "targets", "target")
    .map((item) => {
      const source = asRecord(item);
      const id = readString(source, "id", "target_id", "name");
      if (!id) {
        return null;
      }
      return {
        id,
        label: readString(source, "label", "name", "title") || id,
        platform: readString(source, "platform", "channel", "kind"),
      };
    })
    .filter((value): value is DeliveryTarget => value !== null);
}

export interface CronBlueprint {
  id: string;
  name: string;
  description: string;
}

/** `GET /api/cron/blueprints`。 */
export function normalizeBlueprints(payload: unknown): CronBlueprint[] {
  return pickList(payload, "blueprints", "items")
    .map((item) => {
      const source = asRecord(item);
      const id = readString(source, "id", "blueprint_id", "name");
      if (!id) {
        return null;
      }
      return {
        id,
        name: readString(source, "name", "title", "label") || id,
        description: readString(source, "description", "summary"),
      };
    })
    .filter((value): value is CronBlueprint => value !== null);
}

export interface CronRun {
  id: string;
  status: string;
  startedAt: string;
  message: string;
}

/** `GET /api/cron/jobs/{id}/runs`（含失败事件）。 */
export function normalizeRuns(payload: unknown): CronRun[] {
  return pickList(payload, "runs", "items", "history")
    .map((item, index) => {
      const source = asRecord(item);
      const id = readString(source, "id", "run_id") || `run-${index}`;
      const status = readString(source, "status", "state", "result");
      const startedAt = readString(source, "started_at", "startedAt", "timestamp", "created_at");
      const message = readString(source, "error", "message", "detail", "summary");
      return { id, status, startedAt, message };
    })
    .filter((run) => run.status.toLowerCase().includes("fail") || run.status.toLowerCase().includes("error") || run.message !== "" || run.status !== "");
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
