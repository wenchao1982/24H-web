import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db";

export const SESSION_COOKIE = "24h_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export interface SessionRow {
  id: string;
  user_id: number;
  token_hash: string;
  created_at: number;
  expires_at: number;
  ip: string | null;
  ua: string | null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(
  db: Db,
  input: { userId: number; ip?: string | null; ua?: string | null; ttlMs?: number },
): { token: string; session: SessionRow } {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + (input.ttlMs ?? SESSION_TTL_MS);
  const id = randomBytes(16).toString("hex");

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, ip, ua)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    hashToken(token),
    now,
    expiresAt,
    input.ip ?? null,
    input.ua ?? null,
  );

  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as SessionRow;
  return { token, session };
}

export function findSessionByToken(db: Db, token: string): SessionRow | null {
  const row = db
    .prepare("SELECT * FROM sessions WHERE token_hash = ?")
    .get(hashToken(token)) as SessionRow | undefined;
  return row ?? null;
}

export function deleteSessionByToken(db: Db, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}
