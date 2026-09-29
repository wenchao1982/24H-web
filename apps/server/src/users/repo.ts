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
  external_id: string | null;
  auth_provider: string;
}

export function countUsers(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  return row.n;
}

export function countActiveSuperAdmins(db: Db, excludeId?: number): number {
  const row =
    excludeId === undefined
      ? (db
          .prepare(
            "SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin' AND status = 'active'",
          )
          .get() as { n: number })
      : (db
          .prepare(
            `SELECT COUNT(*) AS n FROM users
             WHERE role = 'super_admin' AND status = 'active' AND id != ?`,
          )
          .get(excludeId) as { n: number });
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

export function findUserByExternalId(
  db: Db,
  provider: string,
  externalId: string,
): UserRow | null {
  const row = db
    .prepare("SELECT * FROM users WHERE auth_provider = ? AND external_id = ?")
    .get(provider, externalId) as UserRow | undefined;
  return row ?? null;
}

function normalizeExternalUsername(raw: string, externalId: string): string {
  const candidate = raw.trim();
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}$/.test(candidate)) {
    return candidate;
  }
  const fallback = `oidc_${externalId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  return fallback.length >= 3 ? fallback : `oidc_user`;
}

function uniqueUsername(db: Db, base: string): string {
  let candidate = base;
  let suffix = 1;
  while (findUserByUsername(db, candidate)) {
    suffix += 1;
    candidate = `${base.slice(0, 28)}_${suffix}`;
  }
  return candidate;
}

/**
 * JIT provision a local user from a trusted external identity (OIDC).
 * 角色保持本地默认（调用方传入，**绝不**自动 super_admin）；口令哈希为随机值，
 * 故无法经 password provider 登录。
 */
export function ensureExternalUser(
  db: Db,
  input: {
    provider: string;
    externalId: string;
    username: string;
    role: UserRow["role"];
  },
): UserRow {
  const existing = findUserByExternalId(db, input.provider, input.externalId);
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const username = uniqueUsername(db, normalizeExternalUsername(input.username, input.externalId));
  const info = db
    .prepare(
      `INSERT INTO users
        (username, password_hash, role, status, must_change_password, created_at, updated_at, external_id, auth_provider)
       VALUES (?, ?, ?, 'active', 0, ?, ?, ?, ?)`,
    )
    .run(
      username,
      randomBytes(32).toString("hex"),
      input.role,
      now,
      now,
      input.externalId,
      input.provider,
    );

  return db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as UserRow;
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

export function userCanAccessProfile(db: Db, userId: number, profile: string): boolean {
  const row = db
    .prepare("SELECT 1 AS ok FROM user_profiles WHERE user_id = ? AND profile_name = ?")
    .get(userId, profile) as { ok: number } | undefined;
  return row !== undefined;
}

/**
 * 租户上下文注入所用 profile（REQ-017 / REQ-022）：
 * `is_default` 优先，回退任一已分配，无任何分配则 `null`。
 */
export function resolveDefaultProfile(db: Db, userId: number): string | null {
  const { profiles, defaultProfile } = listUserProfiles(db, userId);
  return defaultProfile ?? profiles[0] ?? null;
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
