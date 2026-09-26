import { randomBytes } from "node:crypto";
import type { Db } from "../db";
import { hashPassword } from "../auth/password";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: "super_admin" | "admin";
  status: "active" | "disabled";
  must_change_password: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export function countUsers(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  return row.n;
}

export function findUserByUsername(db: Db, username: string): UserRow | null {
  const row = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;
  return row ?? null;
}

export function findUserById(db: Db, id: number): UserRow | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ?? null;
}

export function listUserProfiles(
  db: Db,
  userId: number,
): { profiles: string[]; defaultProfile: string | null } {
  const rows = db
    .prepare(
      "SELECT profile_name, is_default FROM user_profiles WHERE user_id = ? ORDER BY profile_name",
    )
    .all(userId) as { profile_name: string; is_default: number }[];

  const profiles = rows.map((row) => row.profile_name);
  const fallback = rows.find((row) => row.is_default === 1);
  return { profiles, defaultProfile: fallback ? fallback.profile_name : null };
}

export async function createUser(
  db: Db,
  input: { username: string; password: string; role: UserRow["role"] },
): Promise<UserRow> {
  return insertUser(db, {
    username: input.username,
    password: input.password,
    role: input.role,
    mustChangePassword: false,
  });
}

async function insertUser(
  db: Db,
  input: {
    username: string;
    password: string;
    role: UserRow["role"];
    mustChangePassword: boolean;
  },
): Promise<UserRow> {
  const now = Date.now();
  const passwordHash = await hashPassword(input.password);
  const info = db
    .prepare(
      `INSERT INTO users
        (username, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(
      input.username,
      passwordHash,
      input.role,
      input.mustChangePassword ? 1 : 0,
      now,
      now,
    );
  const row = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(info.lastInsertRowid) as UserRow;
  return row;
}

export async function ensureFirstAdmin(
  db: Db,
): Promise<{ created: boolean; username?: string; generatedPassword?: string }> {
  if (countUsers(db) !== 0) {
    return { created: false };
  }

  const username = process.env.OS_ADMIN_USER ?? "admin";
  const envPassword = process.env.OS_ADMIN_PASSWORD;
  const generatedPassword = envPassword ?? randomBytes(12).toString("base64url");

  await insertUser(db, {
    username,
    password: generatedPassword,
    role: "super_admin",
    mustChangePassword: true,
  });

  return {
    created: true,
    username,
    generatedPassword: envPassword ? undefined : generatedPassword,
  };
}
