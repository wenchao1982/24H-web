import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "../hermes/client";
import { resolveTarget } from "../hermes/connections";

/** Web 构建版本（BFF 对外暴露；真实升级由运维在主机侧执行）。 */
export const WEB_VERSION = "0.1.0";

const UPSTREAM_TIMEOUT_MS = 15_000;

export interface SystemRoutesOptions {
  db: Db;
  defaultBaseUrl: string;
}

function readConnectionId(request: FastifyRequest): string | null {
  const query = request.query as Record<string, unknown> | undefined;
  const value = query?.connection;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readAction(body: unknown): string {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>).action;
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "apply";
}

/**
 * 系统版本 / 升级（BFF 自有）：
 * - `GET /api/system/version`：核心版本（读 Hermes `/api/status`）+ web 构建版本。
 * - `POST /api/system/update`：返回明确结果——在线升级属运维级，工作台不做实际升级；
 *   可选 `{ action: "queue" }` 返回 `queued`，否则返回 `unsupported`。
 */
export const systemRoutes: FastifyPluginAsync<SystemRoutesOptions> = async (app, opts) => {
  app.get("/api/system/version", { preHandler: requireAuth }, async (request) => {
    const target = resolveTarget(opts.db, opts.defaultBaseUrl, readConnectionId(request));
    const upstream = hermesUpstream({ hermesBaseUrl: opts.defaultBaseUrl }, target.baseUrl);
    try {
      const token = target.token ?? (await getHermesToken(upstream.baseUrl));
      const response = await fetch(`${upstream.baseUrl}/api/status`, {
        headers: { "x-hermes-session-token": token },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) {
        return { ok: false, core: null, web: WEB_VERSION, baseUrl: upstream.baseUrl };
      }
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const core = typeof data.version === "string" ? data.version : null;
      return { ok: true, core, web: WEB_VERSION, baseUrl: upstream.baseUrl };
    } catch {
      return { ok: false, core: null, web: WEB_VERSION, baseUrl: upstream.baseUrl };
    }
  });

  app.post("/api/system/update", { preHandler: requireAuth }, async (request) => {
    const action = readAction(request.body);
    if (action === "queue") {
      return {
        status: "queued",
        action,
        message: "升级请求已记录；实际升级需由运维在主机侧执行。",
      };
    }
    return {
      status: "unsupported",
      action,
      message: "在线升级不受支持；请在主机侧由运维执行升级。",
    };
  });
};
