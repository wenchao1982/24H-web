import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db";
import { logAudit } from "../audit/repo";
import { requireAuth } from "../session/middleware";
import {
  getGithubStatus,
  githubConnect,
  listGithubRepos,
  spawnGh,
  type GhRunner,
} from "../integrations/github";

export interface IntegrationsRoutesOptions {
  db: Db;
  /** 可注入的 gh 执行器；默认 `spawnGh`。 */
  githubRunner?: GhRunner;
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

/**
 * GitHub 集成（BFF 自有）：`gh` 登录/状态、仓库列表。
 * gh 只在服务端以参数数组执行（`shell:false`），token 不回传。
 */
export const integrationsRoutes: FastifyPluginAsync<IntegrationsRoutesOptions> = async (
  app,
  opts,
) => {
  const runner: GhRunner = opts.githubRunner ?? spawnGh;

  app.get("/api/integrations/github", { preHandler: requireAuth }, async () => {
    const status = await getGithubStatus(runner);
    return status;
  });

  app.post("/api/integrations/github", { preHandler: requireAuth }, async (request) => {
    const action = readString(request.body, "action") || "connect";

    if (action === "repos") {
      const repos = await listGithubRepos(runner);
      return { repos };
    }

    const token = readString(request.body, "token");
    const status = await githubConnect(runner, token);

    logAudit(opts.db, {
      actorId: request.user?.id ?? null,
      action: "integration.github.connect",
      targetType: "integration",
      targetId: "github",
      ip: request.ip,
      detail: JSON.stringify({ username: status.username }),
    });

    return status;
  });
};
