import type { Db } from "../db";
import { findUserById, type UserRow } from "../users/repo";
import { findSessionByToken } from "./repo";

export function resolveSessionUser(db: Db, token: string): UserRow | null {
  const session = findSessionByToken(db, token);
  if (!session || session.expires_at <= Date.now()) {
    return null;
  }

  const user = findUserById(db, session.user_id);
  if (!user || user.status !== "active") {
    return null;
  }

  return user;
}
