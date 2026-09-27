/**
 * M16 T23.5 凭证池：解析 `credential_pools` 配置为「provider → 轮换密钥数组」，
 * 供面板展示数量与掩码。**真实密钥值只保存在内存用于合并写回，绝不渲染。**
 */

import { configValue } from "./configForm";

export interface CredentialProvider {
  provider: string;
  /** 已配置的凭证数量。 */
  count: number;
}

export interface CredentialPoolsState {
  providers: CredentialProvider[];
  /** provider → 凭证数组（可能含真实值，仅用于合并写回）。 */
  pools: Record<string, unknown[]>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toKeyList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (typeof value === "string") {
    return value.trim() === "" ? [] : [value];
  }
  const record = asRecord(value);
  for (const key of ["keys", "items", "tokens", "credentials"]) {
    if (Array.isArray(record[key])) {
      return [...(record[key] as unknown[])];
    }
  }
  // 对象形态：每个键视为一条凭证。
  const entries = Object.entries(record);
  return entries.length > 0 ? entries.map(([, entry]) => entry) : [];
}

/** 从完整 config 中提取 credential_pools。 */
export function normalizeCredentialPools(config: unknown): CredentialPoolsState {
  const raw = asRecord(configValue(asRecord(config), "credential_pools"));
  const pools: Record<string, unknown[]> = {};
  for (const [provider, value] of Object.entries(raw)) {
    const list = toKeyList(value);
    pools[provider] = list;
  }
  const providers = Object.entries(pools).map(([provider, list]) => ({
    provider,
    count: list.length,
  }));
  return { providers, pools };
}

/** 掩码占位（永不返回真实值）。 */
export function maskKey(): string {
  return "••••••••";
}
