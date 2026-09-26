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
  avatar: string | null;
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

export interface UserSummary {
  id: number;
  username: string;
  role: UserRow["role"];
  status: UserRow["status"];
  profiles: string[];
  default_profile: string | null;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  must_change_password: number;
}

function toUserSummary(
  user: UserRow,
  profiles: { profiles: string[]; defaultProfile: string | null },
): UserSummary {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    profiles: profiles.profiles,
    default_profile: profiles.defaultProfile,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at,
    must_change_password: user.must_change_password,
  };
}

export function listUsers(db: Db): UserSummary[] {
  const users = db.prepare("SELECT * FROM users ORDER BY id").all() as UserRow[];
  const assignments = db
    .prepare("SELECT user_id, profile_name, is_default FROM user_profiles ORDER BY profile_name")
    .all() as { user_id: number; profile_name: string; is_default: number }[];

  const byUser = new Map<number, { profiles: string[]; defaultProfile: string | null }>();
  for (const row of assignments) {
    let entry = byUser.get(row.user_id);
    if (!entry) {
      entry = { profiles: [], defaultProfile: null };
      byUser.set(row.user_id, entry);
    }
    entry.profiles.push(row.profile_name);
    if (row.is_default === 1) {
      entry.defaultProfile = row.profile_name;
    }
  }

  return users.map((user) =>
    toUserSummary(user, byUser.get(user.id) ?? { profiles: [], defaultProfile: null }),
  );
}

export function getUserSummary(db: Db, id: number): UserSummary | null {
  const user = findUserById(db, id);
  if (!user) {
    return null;
  }
  return toUserSummary(user, listUserProfiles(db, id));
}

export async function createUser(
  db: Db,
  input: {
    username: string;
    password: string;
    role: UserRow["role"];
    mustChangePassword?: boolean;
  },
): Promise<UserRow> {
  return insertUser(db, {
    username: input.username,
    password: input.password,
    role: input.role,
    mustChangePassword: input.mustChangePassword ?? false,
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
