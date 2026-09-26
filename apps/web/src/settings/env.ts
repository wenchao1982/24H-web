/**
 * Keys 管理的纯函数工具。
 * 安全约定：只解析键名，绝不保存或回显任何密钥明文。
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** 从 `GET /api/env` 的多种返回形态提取键名（仅名称）。 */
export function normalizeEnvNames(payload: unknown): string[] {
  const names = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim() !== "") {
      names.add(value.trim());
    }
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (typeof item === "string") {
        push(item);
      } else {
        push(asRecord(item).name);
      }
    }
  } else {
    const raw = asRecord(payload);
    const list = Array.isArray(raw.keys)
      ? raw.keys
      : Array.isArray(raw.env)
        ? raw.env
        : [];
    for (const item of list) {
      if (typeof item === "string") {
        push(item);
      } else {
        push(asRecord(item).name);
      }
    }
    const env = raw.env;
    if (env && typeof env === "object" && !Array.isArray(env)) {
      for (const key of Object.keys(env as Record<string, unknown>)) {
        push(key);
      }
    }
  }

  return [...names].sort();
}

/** 校验环境变量键名（与 BFF 约定一致）。 */
export const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
