import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { ApiError } from "../http/errors";

export interface ConnectionRow {
  id: string;
  label: string;
  url: string;
  token: string | null;
  created_at: number;
  is_default: number;
}

export interface ConnectionView {
  id: string;
  label: string;
  url: string;
  has_token: boolean;
  created_at: number;
  is_default: boolean;
}

export interface ResolvedTarget {
  baseUrl: string;
  token: string | null;
  connectionId: string | null;
}

export function toConnectionView(row: ConnectionRow): ConnectionView {
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    has_token: row.token !== null && row.token !== "",
    created_at: row.created_at,
    is_default: row.is_default === 1,
  };
}

export function listConnections(db: Db): ConnectionView[] {
  const rows = db
    .prepare("SELECT * FROM connections ORDER BY created_at, id")
    .all() as ConnectionRow[];
  return rows.map(toConnectionView);
}

export function getConnection(db: Db, id: string): ConnectionRow | null {
  const row = db.prepare("SELECT * FROM connections WHERE id = ?").get(id) as
    | ConnectionRow
    | undefined;
  return row ?? null;
}

export function getDefaultConnection(db: Db): ConnectionRow | null {
  const row = db
    .prepare("SELECT * FROM connections WHERE is_default = 1 ORDER BY created_at, id LIMIT 1")
    .get() as ConnectionRow | undefined;
  return row ?? null;
}

function clearDefaults(db: Db): void {
  db.prepare("UPDATE connections SET is_default = 0 WHERE is_default = 1").run();
}

export function createConnection(
  db: Db,
  input: { label: string; url: string; token?: string | null; isDefault?: boolean },
): ConnectionRow {
  const id = randomUUID();
  const now = Date.now();
  const insert = db.transaction(() => {
    if (input.isDefault) {
      clearDefaults(db);
    }
    db.prepare(
      `INSERT INTO connections (id, label, url, token, created_at, is_default)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.label, input.url, input.token ?? null, now, input.isDefault ? 1 : 0);
  });
  insert();
  return getConnection(db, id)!;
}

export function updateConnection(
  db: Db,
  id: string,
  input: { label?: string; url?: string; token?: string | null; isDefault?: boolean },
): ConnectionRow | null {
  const existing = getConnection(db, id);
  if (!existing) {
    return null;
  }
  const label = input.label ?? existing.label;
  const url = input.url ?? existing.url;
  const token = input.token === undefined ? existing.token : input.token;
  const isDefault = input.isDefault === undefined ? existing.is_default === 1 : input.isDefault;

  const update = db.transaction(() => {
    if (isDefault) {
      clearDefaults(db);
    }
    db.prepare("UPDATE connections SET label = ?, url = ?, token = ?, is_default = ? WHERE id = ?").run(
      label,
      url,
      token,
      isDefault ? 1 : 0,
      id,
    );
  });
  update();
  return getConnection(db, id);
}

export function deleteConnection(db: Db, id: string): boolean {
  const info = db.prepare("DELETE FROM connections WHERE id = ?").run(id);
  return info.changes > 0;
}

/**
 * Pick the upstream for a request: an explicit connection id, else the default
 * connection, else the configured base URL.
 */
export function resolveTarget(
  db: Db,
  defaultBaseUrl: string,
  connectionId?: string | null,
): ResolvedTarget {
  if (connectionId) {
    const row = getConnection(db, connectionId);
    if (!row) {
      throw new ApiError(404, "CONNECTION_NOT_FOUND", "连接不存在");
    }
    return { baseUrl: row.url, token: row.token, connectionId: row.id };
  }

  const fallback = getDefaultConnection(db);
  if (fallback) {
    return { baseUrl: fallback.url, token: fallback.token, connectionId: fallback.id };
  }

  return { baseUrl: defaultBaseUrl, token: null, connectionId: null };
}
