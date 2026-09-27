/**
 * 设置 → 系统 → 升级：BFF `/api/system/version` / `/api/system/update` 解析。
 *
 * 字段以 BFF 契约为准，缺失即降级。
 */

export interface SystemVersion {
  ok: boolean;
  core: string | null;
  web: string | null;
}

export interface UpdateResult {
  status: string;
  message: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** 容错解析 `GET /api/system/version`。 */
export function normalizeVersion(payload: unknown): SystemVersion {
  if (!payload || typeof payload !== "object") {
    return { ok: false, core: null, web: null };
  }
  const record = payload as Record<string, unknown>;
  return {
    ok: record.ok === true,
    core: str(record.core) ?? null,
    web: str(record.web) ?? null,
  };
}

/** 容错解析 `POST /api/system/update`。 */
export function normalizeUpdate(payload: unknown): UpdateResult {
  if (!payload || typeof payload !== "object") {
    return { status: "unsupported", message: "" };
  }
  const record = payload as Record<string, unknown>;
  return {
    status: str(record.status) ?? "unsupported",
    message: str(record.message) ?? "",
  };
}

export function updateParams(action: "apply" | "queue" = "apply"): Record<string, unknown> {
  return { action };
}
