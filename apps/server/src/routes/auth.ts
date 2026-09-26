import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { verifyPassword } from "../auth/password";
import { findUserByUsername, listUserProfiles } from "../users/repo";
import { SESSION_COOKIE, createSession, deleteSessionByToken } from "../session/repo";
import { resolveSessionUser } from "../session/auth";

export interface AuthRoutesOptions {
  db: Db;
}

function readString(body: unknown, key: string): string {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, opts) => {
  const { db } = opts;

  app.post("/api/auth/login", async (request, reply) => {
    const username = readString(request.body, "username");
    const password = readString(request.body, "password");
    if (!username || !password) {
      throw new ApiError(400, "INVALID_INPUT", "用户名和密码不能为空");
    }

    const user = findUserByUsername(db, username);
    if (!user || user.status !== "active") {
      throw new ApiError(401, "INVALID_CREDENTIALS", "用户名或密码错误");
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "用户名或密码错误");
    }

    const { token, session } = createSession(db, {
      userId: user.id,
      ip: request.ip,
      ua: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null,
    });

    const now = Date.now();
    db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(
      now,
      now,
      user.id,
    );

    reply.setCookie(SESSION_COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.headers["x-forwarded-proto"] === "https",
      maxAge: Math.max(0, Math.floor((session.expires_at - now) / 1000)),
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        must_change_password: user.must_change_password,
      },
    };
  });

  app.get("/api/auth/me", async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    const user = token ? resolveSessionUser(db, token) : null;
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "未登录");
    }

    const { profiles, defaultProfile } = listUserProfiles(db, user.id);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      profiles,
      default_profile: defaultProfile,
      must_change_password: user.must_change_password,
    };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      deleteSessionByToken(db, token);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
};
