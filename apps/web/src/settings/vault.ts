/**
 * 设置 → 高级 → 密钥库/连接器：L1 `vault.*` / `connectors.*` 解析与参数。
 *
 * 安全：密钥库**永不**保留/回显明文值，仅保留名称。
 */

export interface VaultEntry {
  name: string;
}

export interface Connector {
  name: string;
  status: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** 容错解析 `vault.list`；**丢弃**任何 value 字段。 */
export function normalizeVaultEntries(payload: unknown): VaultEntry[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).entries ??
        (payload as Record<string, unknown>).keys ??
        (payload as Record<string, unknown>).items ??
        [])
      : [];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry): VaultEntry[] => {
    if (typeof entry === "string") {
      return [{ name: entry }];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const name = str(record.name) ?? str(record.key) ?? str(record.id);
    return name ? [{ name }] : [];
  });
}

/** 容错解析 `connectors.list`。 */
export function normalizeConnectors(payload: unknown): Connector[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).connectors ??
        (payload as Record<string, unknown>).items ??
        [])
      : [];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry): Connector[] => {
    if (typeof entry === "string") {
      return [{ name: entry, status: "unknown" }];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const name = str(record.name) ?? str(record.id);
    if (!name) {
      return [];
    }
    const rawStatus = str(record.status) ?? str(record.state) ?? "";
    const status = record.connected === true ? "connected" : rawStatus || "unknown";
    return [{ name, status }];
  });
}

export function vaultAddParams(name: string, value: string): Record<string, unknown> {
  return { name: name.trim(), value };
}

export function vaultRemoveParams(name: string): Record<string, unknown> {
  return { name };
}
