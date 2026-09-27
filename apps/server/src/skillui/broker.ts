import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ApiError } from "../http/errors";
import { llmOneshot } from "../hermes/oneshot";
import type { DiscoveredSkillUi } from "./types";

/** 宿主支持的能力白名单（其余一律 403；仍需 manifest 声明）。 */
export const SKILL_HOST_METHODS = ["callModel", "readFile", "notify"] as const;
export type SkillHostMethod = (typeof SKILL_HOST_METHODS)[number];

const METHOD_SET = new Set<string>(SKILL_HOST_METHODS);

export type CallModelFn = (input: {
  prompt: string;
  model?: string;
}) => Promise<{ text: string; via?: string }>;

export interface SkillHostDeps {
  /** readFile 沙箱根：`<workspaceRoot>/<skillId>/`。 */
  workspaceRoot: string;
  callModel: CallModelFn;
}

/** 默认 readFile 沙箱根（`OS_SKILL_WORKSPACE_ROOT` 可覆盖）。 */
export function defaultWorkspaceRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.OS_SKILL_WORKSPACE_ROOT?.trim();
  return configured && configured !== "" ? resolve(configured) : join(homedir(), ".24h", "workspace");
}

export function defaultSkillHostDeps(baseUrl: string, workspaceRoot: string): SkillHostDeps {
  return {
    workspaceRoot,
    callModel: (input) => llmOneshot(baseUrl, input),
  };
}

export function isWhitelistedMethod(method: string): method is SkillHostMethod {
  return METHOD_SET.has(method);
}

function readString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

/**
 * 执行一次白名单能力调用。方法须同时属于宿主白名单与 manifest capabilities，
 * 否则 403 FORBIDDEN；readFile 路径经解析后必须落在沙箱内，否则 403。
 */
export async function invokeSkillCapability(input: {
  skill: DiscoveredSkillUi;
  method: string;
  params: Record<string, unknown>;
  deps: SkillHostDeps;
}): Promise<unknown> {
  const { skill, method, params, deps } = input;

  if (!isWhitelistedMethod(method) || !skill.info.capabilities.includes(method)) {
    throw new ApiError(403, "FORBIDDEN", `能力未授权：${method}`);
  }

  switch (method) {
    case "callModel": {
      const prompt = readString(params, "prompt").trim();
      if (prompt === "") {
        throw new ApiError(400, "INVALID_INPUT", "prompt 不能为空");
      }
      const model = readString(params, "model").trim();
      const result = await deps.callModel(model !== "" ? { prompt, model } : { prompt });
      return { text: result.text, ...(result.via ? { via: result.via } : {}) };
    }

    case "readFile": {
      const relativePath = readString(params, "path").trim();
      if (relativePath === "") {
        throw new ApiError(400, "INVALID_INPUT", "path 不能为空");
      }
      const sandbox = resolve(deps.workspaceRoot, skill.info.id);
      const target = resolve(sandbox, relativePath);
      const prefix = sandbox.endsWith("/") ? sandbox : `${sandbox}/`;
      if (target !== sandbox && !target.startsWith(prefix)) {
        throw new ApiError(403, "PATH_OUTSIDE_WORKSPACE", "路径越界");
      }
      let content: string;
      try {
        content = readFileSync(target, "utf8");
      } catch {
        throw new ApiError(404, "FILE_NOT_FOUND", "文件不存在");
      }
      return { path: relativePath, content };
    }

    case "notify": {
      return { ok: true };
    }
  }
}
