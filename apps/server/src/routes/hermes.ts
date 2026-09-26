import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "../hermes/client";

export interface HermesRoutesOptions {
  db: Db;
  defaultBaseUrl: string;
}

function hasRequestBody(method: string, body: unknown): boolean {
  return method !== "GET" && method !== "HEAD" && body !== undefined && body !== null;
}

/**
 * Proxy `/api/hermes/*` to the Hermes REST API (`/api/*`), injecting the
 * loopback session token. The token never reaches the client.
 */
export const hermesRoutes: FastifyPluginAsync<HermesRoutesOptions> = async (app, opts) => {
  const defaultBaseUrl = opts.defaultBaseUrl;

  app.all("/api/hermes/*", { preHandler: requireAuth }, async (request, reply) => {
    const upstream = hermesUpstream({ hermesBaseUrl: defaultBaseUrl });
    const rest = (request.params as { "*"?: string })["*"] ?? "";
    const queryIndex = request.url.indexOf("?");
    const query = queryIndex >= 0 ? request.url.slice(queryIndex) : "";
    const target = `${upstream.baseUrl}/api/${rest}${query}`;

    const token = await getHermesToken(upstream.baseUrl);

    const headers: Record<string, string> = { "x-hermes-session-token": token };
    const init: RequestInit = { method: request.method, headers };
    if (hasRequestBody(request.method, request.body)) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(request.body);
    }

    const response = await fetch(target, init);
    reply.status(response.status);

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (contentType.includes("application/json")) {
      return reply.send(text.length > 0 ? JSON.parse(text) : null);
    }
    return reply.type(contentType || "text/plain").send(text);
  });
};
