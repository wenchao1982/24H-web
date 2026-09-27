/**
 * 设置 → 高级 → 门户：Plan / 用量入口的容错解析。
 *
 * 字段以官方契约为准（`/api/portal`），缺失即降级。
 */

export interface PortalUsage {
  used?: number;
  limit?: number;
  unit?: string;
  label?: string;
}

export interface PortalInfo {
  plan: string;
  status?: string;
  renewsAt?: string;
  usage?: PortalUsage;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** 容错解析 `GET /api/hermes/portal`。 */
export function normalizePortal(payload: unknown): PortalInfo | null {
  const root = objectOf(payload);
  const planSource = objectOf(root.plan);
  const sub = objectOf(root.subscription);

  const plan =
    (typeof root.plan === "string" ? root.plan : undefined) ??
    str(planSource.name) ??
    str(planSource.id) ??
    str(sub.plan) ??
    str(root.tier) ??
    null;
  if (!plan) {
    return null;
  }

  const usageSource = objectOf(root.usage ?? sub.usage);
  const usage: PortalUsage = {
    used: num(usageSource.used ?? usageSource.usage),
    limit: num(usageSource.limit ?? usageSource.quota),
    unit: str(usageSource.unit),
    label: str(usageSource.label) ?? str(usageSource.metric),
  };

  const info: PortalInfo = { plan };
  const status = str(root.status) ?? str(planSource.status) ?? str(sub.status);
  if (status) {
    info.status = status;
  }
  const renewsAt =
    str(root.renews_at) ?? str(root.renewsAt) ?? str(sub.renews_at) ?? str(sub.current_period_end);
  if (renewsAt) {
    info.renewsAt = renewsAt;
  }
  if (usage.used !== undefined || usage.limit !== undefined || usage.label) {
    info.usage = usage;
  }
  return info;
}

/** 用量可读文本，如 `1,200 / 10,000`。 */
export function formatUsage(usage: PortalUsage): string {
  const format = (value: number | undefined) =>
    value === undefined ? "?" : value.toLocaleString("en-US");
  if (usage.used === undefined && usage.limit === undefined) {
    return usage.label ?? "";
  }
  const base = `${format(usage.used)} / ${format(usage.limit)}`;
  const suffix = usage.unit ? ` ${usage.unit}` : "";
  return `${usage.label ? `${usage.label} ` : ""}${base}${suffix}`;
}
