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
