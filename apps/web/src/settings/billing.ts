/**
 * 设置 → 高级 → 计费/套餐：L1 `billing.state` / `subscription.*` 解析（只读）。
 *
 * 字段以官方契约为准，缺失即降级。
 */

export interface BillingInfo {
  plan?: string;
  status?: string;
  renewsAt?: string;
  seats?: number;
  balance?: string;
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

/** 容错解析计费/订阅信息，合并多个来源。 */
export function normalizeBilling(...payloads: unknown[]): BillingInfo {
  const root: Record<string, unknown> = {};
  for (const payload of payloads) {
    if (payload && typeof payload === "object") {
      Object.assign(root, objectOf(payload));
    }
  }
  const planObj = objectOf(root.plan);
  const sub = objectOf(root.subscription);

  const info: BillingInfo = {};
  const plan =
    (typeof root.plan === "string" ? root.plan : undefined) ??
    str(planObj.name) ??
    str(sub.plan) ??
    str(root.tier);
  if (plan) {
    info.plan = plan;
  }
  const status = str(root.status) ?? str(planObj.status) ?? str(sub.status);
  if (status) {
    info.status = status;
  }
  const renewsAt =
    str(root.renews_at) ?? str(root.current_period_end) ?? str(sub.renews_at);
  if (renewsAt) {
    info.renewsAt = renewsAt;
  }
  const seats = num(root.seats) ?? num(sub.seats) ?? num(planObj.seats);
  if (seats !== undefined) {
    info.seats = seats;
  }
  const balanceSource = objectOf(root.balance);
  const amount = num(balanceSource.amount) ?? num(root.balance);
  if (amount !== undefined) {
    const currency = str(balanceSource.currency) ?? str(root.currency);
    info.balance = currency ? `${amount} ${currency}` : String(amount);
  } else if (typeof root.balance === "string" && root.balance.trim() !== "") {
    info.balance = root.balance;
  }
  return info;
}
