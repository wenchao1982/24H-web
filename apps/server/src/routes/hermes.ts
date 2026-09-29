import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { logAudit } from "../audit/repo";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "../hermes/client";
import { resolveTarget } from "../hermes/connections";
import { resolveDefaultProfile, userCanAccessProfile } from "../users/repo";

export interface HermesRoutesOptions {
  db: Db;
  defaultBaseUrl: string;
}

const UPSTREAM_TIMEOUT_MS = 15_000;

/** profile-agnostic REST 路径（`/api/hermes/` 之后的部分），豁免租户上下文注入。 */
const PROFILE_AGNOSTIC_PATHS: ReadonlySet<string> = new Set(["health"]);

function hasRequestBody(method: string, body: unknown): boolean {
  return method !== "GET" && method !== "HEAD" && body !== undefined && body !== null;
}

function readStringField(value: unknown, key: string): string {
  if (value && typeof value === "object") {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === "string" && field.trim() !== "") {
      return field.trim();
    }
  }
  return "";
}

function requestProfile(request: FastifyRequest): string {
  return readStringField(request.query, "profile") || readStringField(request.body, "profile");
}

/**
 * REST 租户守卫（REQ-022，default-deny）。
 *
 * 非 `super_admin` 且缺 `profile` 时：除豁免路径外注入调用者 `default_profile`
 * （回退任一已分配），无可用 → 403。**禁止**在缺 `profile` 时提前 `return` 跳过守卫。
 */
function enforceProfileAccess(
  db: Db,
  request: FastifyRequest,
  rest: string,
): { injectedProfile: string | null } {
  const user = request.user;
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "未登录");
  }
  if (user.role === "super_admin") {
    return { injectedProfile: null };
  }

  let profile = requestProfile(request);
  let injectedProfile: string | null = null;

  if (profile === "") {
    if (PROFILE_AGNOSTIC_PATHS.has(rest)) {
      return { injectedProfile: null };
    }
    const fallback = resolveDefaultProfile(db, user.id);
    if (!fallback) {
      logAudit(db, {
        actorId: user.id,
        action: "rest.profile.forbidden",
        targetType: "hermes_rest",
        targetId: null,
        ip: request.ip,
        detail: JSON.stringify({ path: request.url.split("?")[0] }),
      });
      throw new ApiError(403, "PROFILE_FORBIDDEN", "无权访问该 profile");
    }
    profile = fallback;
    injectedProfile = fallback;
  }

  if (!userCanAccessProfile(db, user.id, profile)) {
    logAudit(db, {
      actorId: user.id,
      action: "rest.profile.forbidden",
      targetType: "hermes_rest",
      targetId: profile,
      ip: request.ip,
      detail: JSON.stringify({ path: request.url.split("?")[0] }),
    });
    throw new ApiError(403, "PROFILE_FORBIDDEN", "无权访问该 profile");
  }

  return { injectedProfile };
}

function resolveRequestTarget(db: Db, defaultBaseUrl: string, request: FastifyRequest) {
  const connectionId = readStringField(request.query, "connection") || null;
  const target = resolveTarget(db, defaultBaseUrl, connectionId);
  const upstream = hermesUpstream({ hermesBaseUrl: defaultBaseUrl }, target.baseUrl);
  return { upstream, token: target.token };
}

/**
 * Proxy `/api/hermes/*` to the Hermes REST API (`/api/*`), injecting the
 * loopback session token. The token never reaches the client.
 */
export const hermesRoutes: FastifyPluginAsync<HermesRoutesOptions> = async (app, opts) => {
  const defaultBaseUrl = opts.defaultBaseUrl;

  app.get("/api/hermes/health", { preHandler: requireAuth }, async (request) => {
    const { upstream, token: explicitToken } = resolveRequestTarget(
      opts.db,
      defaultBaseUrl,
      request,
    );
    try {
      const token = explicitToken ?? (await getHermesToken(upstream.baseUrl));
      const response = await fetch(`${upstream.baseUrl}/api/status`, {
        headers: { "x-hermes-session-token": token },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) {
        return { ok: false, baseUrl: upstream.baseUrl };
      }
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const version = typeof data.version === "string" ? data.version : undefined;
      return { ok: true, ...(version ? { version } : {}), baseUrl: upstream.baseUrl };
    } catch {
      return { ok: false, baseUrl: upstream.baseUrl };
    }
  });

  app.all("/api/hermes/*", { preHandler: requireAuth }, async (request, reply) => {
    const rest = (request.params as { "*"?: string })["*"] ?? "";
    const { injectedProfile } = enforceProfileAccess(opts.db, request, rest);

    const { upstream, token: explicitToken } = resolveRequestTarget(
      opts.db,
      defaultBaseUrl,
      request,
    );
    const queryIndex = request.url.indexOf("?");
    let query = queryIndex >= 0 ? request.url.slice(queryIndex) : "";
    if (injectedProfile !== null && !new URLSearchParams(query).has("profile")) {
      // 注入必须落入**被转发的 query**：后续 target 由 `request.url` 构造，
      // 仅改 `request.query` 会让守卫通过但上游拿不到 profile（静默失效）。
      query = `${query === "" ? "?" : `${query}&`}profile=${encodeURIComponent(injectedProfile)}`;
    }
    const target = `${upstream.baseUrl}/api/${rest}${query}`;

    const token = explicitToken ?? (await getHermesToken(upstream.baseUrl));

    const headers: Record<string, string> = { "x-hermes-session-token": token };
    const init: RequestInit = {
      method: request.method,
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    };
    if (hasRequestBody(request.method, request.body)) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(request.body);
    }

    let response: Response;
    try {
      response = await fetch(target, init);
    } catch {
      throw new ApiError(502, "HERMES_UNREACHABLE", "无法连接 Hermes 上游");
    }

    reply.status(response.status);

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (text.length === 0) {
      return reply.send(null);
    }

    if (contentType.includes("application/json")) {
      try {
        return reply.send(JSON.parse(text));
      } catch {
        return reply.send({ error: "UPSTREAM_ERROR", message: text });
      }
    }

    return reply.send({ error: "UPSTREAM_ERROR", message: text });
  });
};
