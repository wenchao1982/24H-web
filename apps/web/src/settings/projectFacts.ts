/**
 * 设置 → 高级 → 项目事实/校验：L1 `project.facts` / `verification.status` 解析。
 *
 * 字段以官方契约为准，缺失即降级。
 */

export interface Fact {
  key: string;
  value: string;
}

export interface Check {
  name: string;
  status: string;
}

export interface Verification {
  state: string;
  detail?: string;
  checks: Check[];
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function display(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** 容错解析 `project.facts`：对象键值 / 数组 `{key,value}`。 */
export function normalizeFacts(payload: unknown): Fact[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((entry): Fact[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const record = entry as Record<string, unknown>;
      const key = str(record.key) ?? str(record.name) ?? str(record.label);
      if (!key) {
        return [];
      }
      return [{ key, value: display(record.value ?? record.text ?? record.fact) }];
    });
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const source =
      record.facts && typeof record.facts === "object" && !Array.isArray(record.facts)
        ? (record.facts as Record<string, unknown>)
        : record;
    return Object.entries(source)
      .filter(([key]) => key !== "ok" && key !== "status")
      .map(([key, value]) => ({ key, value: display(value) }));
  }
  return [];
}

/** 容错解析 `verification.status`。 */
export function normalizeVerification(payload: unknown): Verification | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const state =
    str(record.status) ??
    str(record.state) ??
    (record.ok === true ? "ok" : record.ok === false ? "failed" : "");
  const checksSource = Array.isArray(record.checks) ? record.checks : [];
  const checks = checksSource.flatMap((entry): Check[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const item = entry as Record<string, unknown>;
    const name = str(item.name) ?? str(item.check) ?? str(item.id);
    return name ? [{ name, status: str(item.status) ?? str(item.state) ?? "unknown" }] : [];
  });
  const detail = str(record.detail) ?? str(record.message);
  const result: Verification = { state, checks };
  if (detail) {
    result.detail = detail;
  }
  return result;
}
