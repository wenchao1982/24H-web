import { readFileSync } from "node:fs";
import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../http/errors";
import { requireAuth } from "../session/middleware";
import { discoverSkillUis, findSkillUi, resolveSkillAsset } from "../skillui/discover";
import { invokeSkillCapability, type SkillHostDeps } from "../skillui/broker";

export interface SkillUiRoutesOptions {
  roots: string[];
  deps: SkillHostDeps;
}

const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'none'";

function readBodyString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

/**
 * Skill UI 宿主（命令式 `24os-skill-ui/1` 最小实现）：
 * - `GET /api/skill-uis` 发现自带 `ui/manifest.json` 的 skill；
 * - `GET /api/skill-uis/:id` 单个 UI 信息；
 * - `GET /skill-ui/:id/*` 静态托管（防穿越 + 扩展名白名单）；
 * - `POST /api/skill-host/invoke` 白名单能力 broker。
 */
export const skillUiRoutes: FastifyPluginAsync<SkillUiRoutesOptions> = async (app, opts) => {
  app.get("/api/skill-uis", { preHandler: requireAuth }, async () => ({
    skills: discoverSkillUis(opts.roots).map((skill) => skill.info),
  }));

  app.get("/api/skill-uis/:id", { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const skill = findSkillUi(opts.roots, id);
    if (!skill) {
      throw new ApiError(404, "SKILL_UI_NOT_FOUND", "未找到 Skill UI");
    }
    return skill.info;
  });

  app.post("/api/skill-host/invoke", { preHandler: requireAuth }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const skillId = readBodyString(body, "skillId");
    const method = readBodyString(body, "method");
    if (skillId === "" || method === "") {
      throw new ApiError(400, "INVALID_INPUT", "缺少 skillId 或 method");
    }

    const skill = findSkillUi(opts.roots, skillId);
    if (!skill) {
      throw new ApiError(404, "SKILL_UI_NOT_FOUND", "未找到 Skill UI");
    }

    const rawParams = body.params;
    const params =
      rawParams && typeof rawParams === "object"
        ? (rawParams as Record<string, unknown>)
        : {};

    try {
      const result = await invokeSkillCapability({ skill, method, params, deps: opts.deps });
      return { ok: true, result };
    } catch (error) {
      if (error instanceof ApiError) {
        return reply
          .status(error.status)
          .send({ ok: false, error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  app.get("/skill-ui/:id/*", async (request, reply) => {
    const params = request.params as { id: string; "*": string };
    const skill = findSkillUi(opts.roots, params.id);
    if (!skill) {
      throw new ApiError(404, "SKILL_UI_NOT_FOUND", "未找到 Skill UI");
    }

    const asset = resolveSkillAsset(skill.uiRoot, params["*"] ?? "");
    if (!asset) {
      throw new ApiError(404, "SKILL_ASSET_NOT_FOUND", "资源不存在");
    }

    let data: Buffer;
    try {
      data = readFileSync(asset.absolutePath);
    } catch {
      throw new ApiError(404, "SKILL_ASSET_NOT_FOUND", "资源不存在");
    }

    reply.header("content-security-policy", CSP);
    reply.header("x-content-type-options", "nosniff");
    return reply.type(asset.contentType).send(data);
  });
};
