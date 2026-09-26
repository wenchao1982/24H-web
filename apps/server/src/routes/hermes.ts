import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "../hermes/client";
import { userCanAccessProfile } from "../users/repo";

export interface HermesRoutesOptions {
  db: Db;
  defaultBaseUrl: string;
}

const UPSTREAM_TIMEOUT_MS = 15_000;

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

function assertProfileAccess(db: Db, request: FastifyRequest): void {
  const user = request.user;
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "未登录");
  }
  const profile = requestProfile(request);
  if (!profile || user.role === "super_admin") {
    return;
  }
  if (!userCanAccessProfile(db, user.id, profile)) {
    throw new ApiError(403, "PROFILE_FORBIDDEN", "无权访问该 profile");
  }
}

/**
 * Proxy `/api/hermes/*` to the Hermes REST API (`/api/*`), injecting the
 * loopback session token. The token never reaches the client.
 */
export const hermesRoutes: FastifyPluginAsync<HermesRoutesOptions> = async (app, opts) => {
  const defaultBaseUrl = opts.defaultBaseUrl;

  app.all("/api/hermes/*", { preHandler: requireAuth }, async (request, reply) => {
    assertProfileAccess(opts.db, request);

    const upstream = hermesUpstream({ hermesBaseUrl: defaultBaseUrl });
    const rest = (request.params as { "*"?: string })["*"] ?? "";
    const queryIndex = request.url.indexOf("?");
    const query = queryIndex >= 0 ? request.url.slice(queryIndex) : "";
    const target = `${upstream.baseUrl}/api/${rest}${query}`;

    const token = await getHermesToken(upstream.baseUrl);

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
