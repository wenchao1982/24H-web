import { join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db";
import { logAudit } from "../audit/repo";
import { requireAuth, requireSuperAdmin } from "../session/middleware";
import { CODING_AGENTS } from "./definitions";
import { listAgents, type AgentsDeps } from "./registry";
import { checkAgentUpdate, installAgent, uninstallAgent } from "./installer";
import { loadPolicies, setPolicy } from "./updatePolicy";
import { spawnCommand, type CommandRunner } from "./runner";

export interface AgentsRoutesOptions {
  db: Db;
  /** 受管安装目录（`npm -g --prefix`）。 */
  agentsDir: string;
  /** 策略文件目录。 */
  stateDir: string;
  /** 可注入的执行器（测试用假实现）。 */
  runner?: CommandRunner;
}

/**
 * 外部 agent 运行时管理（BFF 自有，M22）：
 * 读=认证；装/卸/策略=`super_admin`；命令以参数数组执行（`shell:false`）。
 * 外部 agent 的会话导入走 Hermes `session.foreign.*`，注册走 `import-agent`。
 */
export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (app, opts) => {
  const deps: AgentsDeps = {
    managedDir: opts.agentsDir,
    managedBin: join(opts.agentsDir, "bin"),
    runner: opts.runner ?? spawnCommand,
  };

  app.get("/api/agents", { preHandler: requireAuth }, async () => ({
    agents: await listAgents(deps),
  }));

  app.get("/api/agents/catalog", { preHandler: requireAuth }, async () => ({
    catalog: CODING_AGENTS.map((definition) => ({
      id: definition.id,
      name: definition.name,
      vendor: definition.vendor,
      bin: definition.bin,
      packageName: definition.packageName,
      installable: Boolean(definition.packageName),
      installCommand: definition.packageName
        ? `npm install -g --prefix ${deps.managedDir} ${definition.packageName}`
        : null,
    })),
  }));

  app.post("/api/agents/:id/install", { preHandler: requireSuperAdmin }, async (request) => {
    const id = (request.params as { id: string }).id;
    const status = await installAgent(id, deps);
    logAudit(opts.db, {
      actorId: request.user?.id ?? null,
      action: "agents.install",
      targetType: "agent",
      targetId: id,
      ip: request.ip,
      detail: JSON.stringify({ version: status.version }),
    });
    return status;
  });

  app.post("/api/agents/:id/check-update", { preHandler: requireAuth }, async (request) => {
    const id = (request.params as { id: string }).id;
    return checkAgentUpdate(id, deps);
  });

  app.delete("/api/agents/:id", { preHandler: requireSuperAdmin }, async (request) => {
    const id = (request.params as { id: string }).id;
    const status = await uninstallAgent(id, deps);
    logAudit(opts.db, {
      actorId: request.user?.id ?? null,
      action: "agents.uninstall",
      targetType: "agent",
      targetId: id,
      ip: request.ip,
    });
    return status;
  });

  app.get("/api/agents/update-policy", { preHandler: requireAuth }, async () => ({
    policies: await loadPolicies(opts.stateDir),
  }));

  app.put("/api/agents/:id/update-policy", { preHandler: requireSuperAdmin }, async (request) => {
    const id = (request.params as { id: string }).id;
    const enabled = (request.body as { enabled?: unknown } | undefined)?.enabled === true;
    const policies = await setPolicy(opts.stateDir, id, enabled);
    logAudit(opts.db, {
      actorId: request.user?.id ?? null,
      action: "agents.update_policy",
      targetType: "agent",
      targetId: id,
      ip: request.ip,
      detail: JSON.stringify({ autoUpdate: enabled }),
    });
    return { policies };
  });
};
