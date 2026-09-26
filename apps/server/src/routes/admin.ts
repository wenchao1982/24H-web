import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { logAudit } from "../audit/repo";
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
};
