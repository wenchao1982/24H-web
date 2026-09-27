/** 消息平台（L2 `/api/messaging/platforms`）规范化与请求体构造。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

export interface PlatformField {
  key: string;
  /** 当前值（密钥不回显，恒为空串）。 */
  value: string;
  secret: boolean;
  /** 该敏感字段上游是否已有值（仅用于展示掩码）。 */
  configured: boolean;
}

export interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  fields: PlatformField[];
}

const SECRET_PATTERN = /(token|secret|password|passwd|api[_-]?key|webhook|credential|app[_-]?secret)/i;

/** 依据字段名判断是否为敏感字段（不猜测 schema，仅启发式）。 */
export function isSecretKey(key: string): boolean {
  return SECRET_PATTERN.test(key);
}

function normalizeFields(config: unknown): PlatformField[] {
  const source = asRecord(config);
  return Object.entries(source).map(([key, value]) => {
    const secret = isSecretKey(key);
    return {
      key,
      value: secret ? "" : typeof value === "string" ? value : "",
      secret,
      configured: secret && typeof value === "string" && value.trim() !== "",
    };
  });
}

/** 列表响应兼容 `[...]` / `{platforms:[...]}` / `{items:[...]}`。 */
export function normalizePlatforms(payload: unknown): Platform[] {
  const source = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : asArray(source.platforms).length > 0
      ? asArray(source.platforms)
      : asArray(source.items);
  const out: Platform[] = [];
  for (const item of list) {
    const entry = asRecord(item);
    const id = readString(entry, "id", "name", "platform", "type");
    if (!id) {
      continue;
    }
    out.push({
      id,
      name: readString(entry, "label", "display_name", "displayName", "name") || id,
      enabled: readBool(entry, false, "enabled", "active", "connected"),
      fields: normalizeFields(entry.config ?? entry.options ?? entry.settings),
    });
  }
  return out;
}

/** 构造 `PUT /api/messaging/platforms/:id` 请求体：空值不入 body（留空保持不变）。 */
export function buildPlatformBody(
  enabled: boolean,
  values: Record<string, string>,
): { enabled: boolean; config: Record<string, string> } {
  const config: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value.trim() !== "") {
      config[key] = value;
    }
  }
  return { enabled, config };
}
