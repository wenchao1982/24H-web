import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { hashPassword } from "../auth/password";
import { listAudit, logAudit } from "../audit/repo";
import {
  countActiveSuperAdmins,
  createUser,
  findUserById,
  findUserByUsername,
  getUserSummary,
  listUsers,
  type UserRow,
} from "../users/repo";
import { requireSuperAdmin } from "../session/middleware";

export interface AdminRoutesOptions {
  db: Db;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}$/;
const ROLES = new Set<UserRow["role"]>(["super_admin", "admin"]);
const STATUSES = new Set<UserRow["status"]>(["active", "disabled"]);

function readString(body: unknown, key: string): string {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function readProfileList(body: unknown): string[] | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const value = (body as Record<string, unknown>).profiles;
  if (!Array.isArray(value)) {
    return null;
  }
  const profiles: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      throw new ApiError(400, "INVALID_INPUT", "profiles 必须是非空字符串数组");
    }
    const name = item.trim();
    if (!profiles.includes(name)) {
      profiles.push(name);
    }
  }
  return profiles;
}

function currentUser(request: FastifyRequest): UserRow {
  const user = request.user;
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "未登录");
  }
  return user;
}

function readIdParam(request: FastifyRequest): number {
  const raw = (request.params as { id?: string }).id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "INVALID_INPUT", "无效的用户 ID");
  }
  return id;
}

function readPage(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, opts) => {
  const { db } = opts;

  app.get("/api/admin/users", { preHandler: requireSuperAdmin }, async () => listUsers(db));

  app.post("/api/admin/users", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const actor = currentUser(request);
    const username = readString(request.body, "username").trim();
    const password = readString(request.body, "password");
    const role = readString(request.body, "role");

    if (!username || !password || !ROLES.has(role as UserRow["role"])) {
      throw new ApiError(400, "INVALID_INPUT", "用户名、密码和角色不能为空且角色需合法");
    }
    if (!USERNAME_PATTERN.test(username)) {
      throw new ApiError(400, "INVALID_USERNAME", "用户名格式不正确");
    }
    if (password.length < 8) {
      throw new ApiError(400, "WEAK_PASSWORD", "密码至少 8 位");
    }
    if (findUserByUsername(db, username)) {
      throw new ApiError(409, "USERNAME_TAKEN", "用户名已被占用");
    }

    const user = await createUser(db, {
      username,
      password,
      role: role as UserRow["role"],
      mustChangePassword: true,
    });

    logAudit(db, {
      actorId: actor.id,
      action: "user.create",
      targetType: "user",
      targetId: String(user.id),
      ip: request.ip,
    });

    reply.status(201);
    return getUserSummary(db, user.id);
  });

  app.patch("/api/admin/users/:id", { preHandler: requireSuperAdmin }, async (request) => {
    const actor = currentUser(request);
    const id = readIdParam(request);

    const roleRaw = readString(request.body, "role");
    const statusRaw = readString(request.body, "status");
    if (roleRaw && !ROLES.has(roleRaw as UserRow["role"])) {
      throw new ApiError(400, "INVALID_INPUT", "角色不合法");
    }
    if (statusRaw && !STATUSES.has(statusRaw as UserRow["status"])) {
      throw new ApiError(400, "INVALID_INPUT", "状态不合法");
    }
    if (!roleRaw && !statusRaw) {
      throw new ApiError(400, "INVALID_INPUT", "没有需要更新的字段");
    }

    const target = findUserById(db, id);
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "用户不存在");
    }

    const newRole = (roleRaw || target.role) as UserRow["role"];
    const newStatus = (statusRaw || target.status) as UserRow["status"];

    const wasActiveSuperAdmin = target.role === "super_admin" && target.status === "active";
    const losesSuperAdmin = newRole !== "super_admin" || newStatus !== "active";
    if (wasActiveSuperAdmin && losesSuperAdmin && countActiveSuperAdmins(db, target.id) === 0) {
      throw new ApiError(409, "LAST_SUPER_ADMIN", "不能禁用或降级最后一个超级管理员");
    }

    db.prepare("UPDATE users SET role = ?, status = ?, updated_at = ? WHERE id = ?").run(
      newRole,
      newStatus,
      Date.now(),
      target.id,
    );

    logAudit(db, {
      actorId: actor.id,
      action: "user.update",
      targetType: "user",
      targetId: String(target.id),
      ip: request.ip,
      detail: JSON.stringify({ role: newRole, status: newStatus }),
    });

    return getUserSummary(db, target.id);
  });

  app.delete("/api/admin/users/:id", { preHandler: requireSuperAdmin }, async (request) => {
    const actor = currentUser(request);
    const id = readIdParam(request);

    const target = findUserById(db, id);
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "用户不存在");
    }
    if (
      target.role === "super_admin" &&
      target.status === "active" &&
      countActiveSuperAdmins(db, target.id) === 0
    ) {
      throw new ApiError(409, "LAST_SUPER_ADMIN", "不能删除最后一个超级管理员");
    }
    if (target.id === actor.id) {
      throw new ApiError(400, "CANNOT_DELETE_SELF", "不能删除自己");
    }

    const remove = db.transaction(() => {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(target.id);
      db.prepare("DELETE FROM user_profiles WHERE user_id = ?").run(target.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
    });
    remove();

    logAudit(db, {
      actorId: actor.id,
      action: "user.delete",
      targetType: "user",
      targetId: String(target.id),
      ip: request.ip,
    });

    return { ok: true };
  });

  app.put(
    "/api/admin/users/:id/profiles",
    { preHandler: requireSuperAdmin },
    async (request) => {
      const actor = currentUser(request);
      const id = readIdParam(request);

      const target = findUserById(db, id);
      if (!target) {
        throw new ApiError(404, "USER_NOT_FOUND", "用户不存在");
      }

      const profiles = readProfileList(request.body);
      if (profiles === null) {
        throw new ApiError(400, "INVALID_INPUT", "profiles 必须是数组");
      }
      const defaultProfile = readString(request.body, "defaultProfile").trim();
      if (defaultProfile && !profiles.includes(defaultProfile)) {
        throw new ApiError(400, "INVALID_INPUT", "defaultProfile 必须是 profiles 之一");
      }

      const replace = db.transaction(() => {
        db.prepare("DELETE FROM user_profiles WHERE user_id = ?").run(target.id);
        const insert = db.prepare(
          `INSERT INTO user_profiles (user_id, profile_name, is_default, created_at)
           VALUES (?, ?, ?, ?)`,
        );
        const now = Date.now();
        for (const profile of profiles) {
          insert.run(target.id, profile, profile === defaultProfile ? 1 : 0, now);
        }
      });
      replace();

      logAudit(db, {
        actorId: actor.id,
        action: "user.profiles.set",
        targetType: "user",
        targetId: String(target.id),
        ip: request.ip,
        detail: JSON.stringify({ profiles, defaultProfile: defaultProfile || null }),
      });

      return getUserSummary(db, target.id);
    },
  );

  app.post(
    "/api/admin/users/:id/password",
    { preHandler: requireSuperAdmin },
    async (request) => {
      const actor = currentUser(request);
      const id = readIdParam(request);

      const target = findUserById(db, id);
      if (!target) {
        throw new ApiError(404, "USER_NOT_FOUND", "用户不存在");
      }

      const password = readString(request.body, "password");
      if (!password) {
        throw new ApiError(400, "INVALID_INPUT", "新密码不能为空");
      }
      if (password.length < 8) {
        throw new ApiError(400, "WEAK_PASSWORD", "密码至少 8 位");
      }

      const passwordHash = await hashPassword(password);
      db.prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?",
      ).run(passwordHash, Date.now(), target.id);

      logAudit(db, {
        actorId: actor.id,
        action: "user.password.reset",
        targetType: "user",
        targetId: String(target.id),
        ip: request.ip,
      });

      return { ok: true };
    },
  );

  app.get("/api/admin/audit", { preHandler: requireSuperAdmin }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = readPage(query.limit, 50, 200);
    const offset = readPage(query.offset, 0, Number.MAX_SAFE_INTEGER);
    return listAudit(db, { limit, offset });
  });
};