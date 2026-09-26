import type { Db } from "../db";

export interface RateLimitConfig {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

interface AttemptRow {
  id: number;
  ip: string;
  username: string;
  count: number;
  locked_until: number | null;
  updated_at: number;
}

function findAttempt(db: Db, ip: string, username: string): AttemptRow | null {
  const row = db
    .prepare("SELECT * FROM login_attempts WHERE ip = ? AND username = ?")
    .get(ip, username) as AttemptRow | undefined;
  return row ?? null;
}

export function getLockedUntil(db: Db, ip: string, username: string): number | null {
  const row = findAttempt(db, ip, username);
  if (!row || row.locked_until === null || row.locked_until <= Date.now()) {
    return null;
  }
  return row.locked_until;
}

export function recordLoginFailure(
  db: Db,
  ip: string,
  username: string,
  cfg: RateLimitConfig = DEFAULT_RATE_LIMIT,
): { locked: boolean; lockedUntil: number | null } {
  const now = Date.now();
  const row = findAttempt(db, ip, username);

  if (!row) {
    db.prepare(
      "INSERT INTO login_attempts (ip, username, count, locked_until, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(ip, username, 1, null, now);
    return { locked: false, lockedUntil: null };
  }

  const lockExpired = row.locked_until !== null && row.locked_until <= now;
  let count = lockExpired || now - row.updated_at > cfg.windowMs ? 0 : row.count;
  count += 1;

  let lockedUntil = row.locked_until !== null && row.locked_until > now ? row.locked_until : null;
  if (count >= cfg.maxFailures && lockedUntil === null) {
    lockedUntil = now + cfg.lockMs;
  }

  db.prepare(
    "UPDATE login_attempts SET count = ?, locked_until = ?, updated_at = ? WHERE id = ?",
  ).run(count, lockedUntil, now, row.id);

  return { locked: count >= cfg.maxFailures, lockedUntil };
}

export function clearLoginFailures(db: Db, ip: string, username: string): void {
  db.prepare("DELETE FROM login_attempts WHERE ip = ? AND username = ?").run(ip, username);
}
