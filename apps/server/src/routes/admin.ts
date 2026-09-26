import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { logAudit } from "../audit/repo";
import {
  createUser,
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
};
