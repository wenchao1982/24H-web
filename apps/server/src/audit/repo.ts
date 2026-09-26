import type { Db } from "../db";

export interface NewAuditEntry {
  actorId: number | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  detail?: string | null;
}

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  at: number;
  ip: string | null;
}

export interface AuditListRow extends AuditEntry {
  actor_username: string | null;
}

export function logAudit(db: Db, entry: NewAuditEntry): void {
  db.prepare(
    `INSERT INTO audit (actor_id, action, target_type, target_id, at, ip, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.actorId,
    entry.action,
    entry.targetType ?? null,
    entry.targetId ?? null,
    Date.now(),
    entry.ip ?? null,
    entry.detail ?? null,
  );
}

export function listAudit(db: Db, opts: { limit: number; offset: number }): AuditListRow[] {
  return db
    .prepare(
      `SELECT a.id, a.actor_id, a.action, a.target_type, a.target_id, a.at, a.ip,
              u.username AS actor_username
       FROM audit a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(opts.limit, opts.offset) as AuditListRow[];
}
