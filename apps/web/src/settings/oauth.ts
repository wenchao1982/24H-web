/** 设置 → 模型服务商 OAuth 的规范化工具。 */

export interface OAuthProvider {
  id: string;
  name: string;
  connected: boolean;
}

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

export function normalizeOAuthProviders(payload: unknown): OAuthProvider[] {
  const raw = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.providers)
      ? raw.providers
      : [];
  const out: OAuthProvider[] = [];
  for (const item of list) {
    const source = asRecord(item);
    const id = readString(source, "id", "name", "provider");
    if (!id) {
      continue;
    }
    out.push({
      id,
      name: readString(source, "name", "label", "provider") || id,
      connected: source.connected === true || source.authorized === true,
    });
  }
  return out;
}

export interface OAuthStart {
  url: string;
  code: string;
}

export function normalizeOAuthStart(payload: unknown): OAuthStart {
  const source = asRecord(payload);
  return {
    url: readString(source, "url", "verification_uri", "verification_url", "auth_url"),
    code: readString(source, "user_code", "code", "device_code"),
  };
}
