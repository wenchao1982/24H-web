/**
 * 设置 → 高级 → 配对与设备：配对设备与 SSH 归属的容错解析。
 *
 * 字段以官方契约为准（`/api/pairing`、`/api/ssh/ownership`），缺失即降级。
 */

export type PairingState = "pending" | "paired" | "revoked" | "unknown";

export interface PairingDevice {
  id: string;
  name: string;
  state: PairingState;
  kind?: string;
  lastSeen?: string;
}

export interface SshOwnership {
  owner: string;
  fingerprint?: string;
  key?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizePairingState(value: unknown): PairingState {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("pend") || raw.includes("await") || raw.includes("request")) {
    return "pending";
  }
  if (raw.includes("pair") || raw.includes("approve") || raw.includes("active")) {
    return "paired";
  }
  if (raw.includes("revoke") || raw.includes("deny") || raw.includes("remove")) {
    return "revoked";
  }
  return "unknown";
}

/**
 * 容错解析 `GET /api/hermes/pairing`：数组 / `{devices}` / `{pending,paired}`。
 * 分区形式时把两组合并，并以分区推断缺失的状态。
 */
export function normalizePairingDevices(payload: unknown): PairingDevice[] {
  const entries: Array<{ entry: unknown; state?: PairingState }> = [];
  if (Array.isArray(payload)) {
    for (const entry of asArray(payload)) {
      entries.push({ entry });
    }
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.devices)) {
      for (const entry of asArray(record.devices)) {
        entries.push({ entry });
      }
    } else {
      for (const state of ["pending", "paired", "revoked"] as PairingState[]) {
        for (const entry of asArray(record[state])) {
          entries.push({ entry, state });
        }
      }
    }
  }

  return entries.flatMap(({ entry, state }): PairingDevice[] => {
    if (typeof entry === "string") {
      return [{ id: entry, name: entry, state: state ?? "unknown" }];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const id = str(record.id) ?? str(record.device_id) ?? str(record.name);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        name: str(record.name) ?? str(record.label) ?? id,
        state: state ?? normalizePairingState(record.status ?? record.state),
        kind: str(record.kind) ?? str(record.type) ?? str(record.platform),
        lastSeen: str(record.last_seen) ?? str(record.lastSeen) ?? str(record.last_active),
      },
    ];
  });
}

/** 容错解析 `GET /api/hermes/ssh/ownership`。 */
export function normalizeSshOwnership(payload: unknown): SshOwnership | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const owner = str(record.owner) ?? str(record.username) ?? str(record.user);
  if (!owner) {
    return null;
  }
  return {
    owner,
    fingerprint: str(record.fingerprint) ?? str(record.fingerprint_sha256),
    key: str(record.key) ?? str(record.public_key),
  };
}

export type PairingAction = "approve" | "revoke";

export function buildPairingAction(id: string): Record<string, unknown> {
  return { id };
}
