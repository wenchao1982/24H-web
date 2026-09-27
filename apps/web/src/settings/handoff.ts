/**
 * 设置 → 高级 → 交接：L1 `handoff.state` / `handoff.fail` 解析与参数。
 *
 * 字段以官方契约为准，缺失即降级。
 */

export interface HandoffState {
  active: boolean;
  id?: string;
  next?: string;
  reason?: string;
  createdAt?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** 容错解析 `handoff.state`。 */
export function normalizeHandoff(payload: unknown): HandoffState {
  if (!payload || typeof payload !== "object") {
    return { active: false };
  }
  const record = payload as Record<string, unknown>;
  const raw = String(record.status ?? record.state ?? "").toLowerCase();
  const active =
    record.active === true ||
    record.pending === true ||
    raw === "active" ||
    raw === "pending" ||
    raw === "waiting";
  const state: HandoffState = { active };
  const id = str(record.id) ?? str(record.handoff_id);
  if (id) {
    state.id = id;
  }
  const next = str(record.next) ?? str(record.next_agent) ?? str(record.to);
  if (next) {
    state.next = next;
  }
  const reason = str(record.reason) ?? str(record.note);
  if (reason) {
    state.reason = reason;
  }
  const createdAt = str(record.created_at) ?? str(record.createdAt) ?? str(record.since);
  if (createdAt) {
    state.createdAt = createdAt;
  }
  return state;
}

export function handoffFailParams(reason: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (reason.trim() !== "") {
    params.reason = reason.trim();
  }
  return params;
}
