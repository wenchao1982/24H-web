/**
 * M16 T23.12 Computer Use：`/api/hermes/tools/computer-use/status` 的容错解析。
 */

export interface ComputerUseStatus {
  /** 内核是否支持 / 已启用 Computer Use。 */
  available: boolean;
  /** 是否已授予权限。 */
  granted: boolean;
  /** 已授予的权限名列表。 */
  permissions: string[];
  /** 可选说明。 */
  detail?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function normalizeComputerUse(payload: unknown): ComputerUseStatus {
  const source = asRecord(payload);
  const availableValue = source.available ?? source.enabled ?? source.supported;
  const grantedValue = source.granted ?? source.permitted ?? source.allowed;
  const permissionsRaw = source.permissions ?? source.scopes ?? source.grants;
  const permissions = Array.isArray(permissionsRaw)
    ? permissionsRaw
        .map((entry) => str(entry) ?? str(asRecord(entry).name) ?? str(asRecord(entry).permission))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const available =
    typeof availableValue === "boolean" ? availableValue : source.status !== undefined || permissions.length > 0;
  const granted =
    typeof grantedValue === "boolean" ? grantedValue : permissions.length > 0;
  const detail = str(source.detail) ?? str(source.message) ?? str(source.status);
  return { available, granted, permissions, ...(detail ? { detail } : {}) };
}
