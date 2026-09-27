import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { issueCsrfToken } from "../http/csrf";
import { verifyPassword, hashPassword } from "../auth/password";
import { authProviderInfos, getPasswordProvider } from "../auth/providers";
import { OIDC_PROVIDER_ID } from "../auth/providers/oidc";
import {
  authorizationUrl,
  claimString,
  createPkce,
  createStateNonce,
  discover,
  exchangeCode,
  readOidcConfig,
  verifyIdToken,
} from "../auth/oidc";
import { clearLoginFailures, getLockedUntil, recordLoginFailure } from "../auth/rateLimit";
import {
  ensureExternalUser,
  findUserByUsername,
  findUserById,
  listUserProfiles,
  type UserRow,
} from "../users/repo";
import { parseAvatarDataUrl } from "../users/avatar";
import { SESSION_COOKIE, createSession, deleteSessionByToken } from "../session/repo";
import { requireAuth } from "../session/middleware";

export interface AuthRoutesOptions {
  db: Db;
}

/** OIDC 流程临时 cookie（state / PKCE verifier / nonce），短时效、HttpOnly。 */
const OIDC_FLOW_COOKIE = "24h_oidc";
const OIDC_FLOW_TTL_SEC = 10 * 60;

function readString(body: unknown, key: string): string {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function readQueryString(request: FastifyRequest, key: string): string {
  const query = request.query as Record<string, unknown> | undefined;
  const value = query?.[key];
  return typeof value === "string" ? value : "";
}

function isSecureRequest(request: FastifyRequest): boolean {
  return request.headers["x-forwarded-proto"] === "https";
}

/** 统一建立会话：写 session cookie + CSRF + last_login。口令与 OIDC 共用。 */
function establishSession(
  db: Db,
  request: FastifyRequest,
  reply: FastifyReply,
  user: UserRow,
): void {
  const secure = isSecureRequest(request);
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
    secure,
    maxAge: Math.max(0, Math.floor((session.expires_at - now) / 1000)),
  });

  issueCsrfToken(reply, { secure });
}

interface OidcFlow {
  state: string;
  verifier: string;
  nonce: string;
}

function encodeFlow(flow: OidcFlow): string {
  return Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
}

function decodeFlow(raw: string): OidcFlow | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OidcFlow>;
    if (
      typeof parsed.state === "string" &&
      typeof parsed.verifier === "string" &&
      typeof parsed.nonce === "string"
    ) {
      return { state: parsed.state, verifier: parsed.verifier, nonce: parsed.nonce };
    }
  } catch {
    // fallthrough
  }
  return null;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, opts) => {
  const { db } = opts;

  app.get("/api/auth/providers", async () => ({ providers: authProviderInfos() }));

  app.get("/api/auth/oidc/start", async (request, reply) => {
    const config = readOidcConfig();
    if (!config) {
      throw new ApiError(404, "OIDC_DISABLED", "未配置 OIDC 登录");
    }

    const discovery = await discover(config.issuer);
    const { state, nonce } = createStateNonce();
    const { verifier, challenge } = createPkce();

    reply.setCookie(OIDC_FLOW_COOKIE, encodeFlow({ state, verifier, nonce }), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(request),
      maxAge: OIDC_FLOW_TTL_SEC,
    });

    return reply.redirect(
      authorizationUrl(config, discovery, { state, nonce, codeChallenge: challenge }),
    );
  });

  app.get("/api/auth/oidc/callback", async (request, reply) => {
    const config = readOidcConfig();
    if (!config) {
      throw new ApiError(404, "OIDC_DISABLED", "未配置 OIDC 登录");
    }

    const code = readQueryString(request, "code");
    const state = readQueryString(request, "state");
    const rawFlow = request.cookies[OIDC_FLOW_COOKIE];
    reply.clearCookie(OIDC_FLOW_COOKIE, { path: "/" });

    const flow = rawFlow ? decodeFlow(rawFlow) : null;
    if (!flow || !code || !state || state !== flow.state) {
      throw new ApiError(400, "OIDC_STATE_MISMATCH", "OIDC 回调校验失败");
    }

    const discovery = await discover(config.issuer);
    const tokens = await exchangeCode(config, discovery, { code, codeVerifier: flow.verifier });
    const claims = await verifyIdToken(config, discovery, {
      idToken: tokens.id_token,
      nonce: flow.nonce,
    });

    const externalId = claimString(claims, "sub");
    if (!externalId) {
      throw new ApiError(401, "OIDC_INVALID_TOKEN", "ID token 缺少 sub");
    }

    const username =
      claimString(claims, "preferred_username", "email") ??
      `${OIDC_PROVIDER_ID}_${externalId.slice(0, 8)}`;

    const user = ensureExternalUser(db, {
      provider: OIDC_PROVIDER_ID,
      externalId,
      username,
      role: "admin",
    });
    if (user.status !== "active") {
      throw new ApiError(403, "USER_DISABLED", "账户已被禁用");
    }

    establishSession(db, request, reply, user);
    return reply.redirect("/");
  });

  app.post("/api/auth/login", async (request, reply) => {
    const username = readString(request.body, "username");
    const password = readString(request.body, "password");
    if (!username || !password) {
      throw new ApiError(400, "INVALID_INPUT", "用户名和密码不能为空");
    }

    const ip = request.ip;
    if (getLockedUntil(db, ip, username)) {
      throw new ApiError(429, "LOGIN_LOCKED", "尝试次数过多，请稍后再试");
    }

    const provider = getPasswordProvider();
    const user = await provider.login({ db, username, password });
    if (!user) {
      const { locked } = recordLoginFailure(db, ip, username);
      if (locked) {
        throw new ApiError(429, "LOGIN_LOCKED", "尝试次数过多，请稍后再试");
      }
      throw new ApiError(401, "INVALID_CREDENTIALS", "用户名或密码错误");
    }

    clearLoginFailures(db, ip, username);

    establishSession(db, request, reply, user);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        must_change_password: user.must_change_password,
      },
    };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    const user = request.user;
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

  app.post("/api/auth/change-password", { preHandler: requireAuth }, async (request) => {
    const user = request.user;
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "未登录");
    }

    const oldPassword = readString(request.body, "oldPassword");
    const newPassword = readString(request.body, "newPassword");
    if (!oldPassword || !newPassword) {
      throw new ApiError(400, "INVALID_INPUT", "旧密码和新密码不能为空");
    }
    if (newPassword.length < 8) {
      throw new ApiError(400, "WEAK_PASSWORD", "新密码至少 8 位");
    }

    const valid = await verifyPassword(oldPassword, user.password_hash);
    if (!valid) {
      throw new ApiError(400, "INVALID_OLD_PASSWORD", "旧密码错误");
    }

    const passwordHash = await hashPassword(newPassword);
    db.prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
    ).run(passwordHash, Date.now(), user.id);

    return { ok: true };
  });

  app.patch("/api/auth/profile", { preHandler: requireAuth }, async (request) => {
    const user = request.user;
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "未登录");
    }

    const username = readString(request.body, "username").trim();
    if (!username) {
      throw new ApiError(400, "INVALID_INPUT", "用户名不能为空");
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}$/.test(username)) {
      throw new ApiError(400, "INVALID_USERNAME", "用户名格式不正确");
    }

    if (username !== user.username) {
      const existing = findUserByUsername(db, username);
      if (existing && existing.id !== user.id) {
        throw new ApiError(409, "USERNAME_TAKEN", "用户名已被占用");
      }
      db.prepare("UPDATE users SET username = ?, updated_at = ? WHERE id = ?").run(
        username,
        Date.now(),
        user.id,
      );
    }

    return { ok: true, username };
  });

  app.put("/api/auth/avatar", { preHandler: requireAuth }, async (request) => {
    const user = request.user;
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "未登录");
    }

    const data = readString(request.body, "data");
    if (!data) {
      throw new ApiError(400, "INVALID_INPUT", "缺少头像数据");
    }

    const avatar = parseAvatarDataUrl(data);
    db.prepare("UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?").run(
      avatar.dataUrl,
      Date.now(),
      user.id,
    );

    return { ok: true };
  });

  app.get("/api/auth/avatar", { preHandler: requireAuth }, async (request) => {
    const user = request.user;
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "未登录");
    }

    const row = findUserById(db, user.id);
    return { data: row?.avatar ?? null };
  });
};
