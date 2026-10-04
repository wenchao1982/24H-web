import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CODING_AGENTS, findDefinition } from "./definitions";
import { ApiError } from "../http/errors";

export interface AgentPolicy {
  autoUpdate: boolean;
}

export type PolicyMap = Record<string, AgentPolicy>;

export function policyPath(stateDir: string): string {
  return join(stateDir, "agents-update-policy.json");
}

/** 读取策略；缺失/损坏 → fail-closed（全部手动，autoUpdate=false）。 */
export async function loadPolicies(stateDir: string): Promise<PolicyMap> {
  let raw: Record<string, { autoUpdate?: unknown }> = {};
  try {
    raw = JSON.parse(await readFile(policyPath(stateDir), "utf8")) as typeof raw;
  } catch {
    raw = {};
  }
  const out: PolicyMap = {};
  for (const definition of CODING_AGENTS) {
    const entry = raw[definition.id];
    out[definition.id] = {
      autoUpdate: Boolean(entry && entry.autoUpdate === true && definition.packageName),
    };
  }
  return out;
}

/** 写入某 agent 的自动更新策略（原子 + 0600）。 */
export async function setPolicy(
  stateDir: string,
  id: string,
  enabled: boolean,
): Promise<PolicyMap> {
  const definition = findDefinition(id);
  if (!definition) {
    throw new ApiError(404, "AGENT_UNKNOWN", `未知外部 agent：${id}`);
  }
  if (enabled && !definition.packageName) {
    throw new ApiError(
      400,
      "AGENT_NOT_SAFE_MANAGED",
      `${definition.name} 无已知安装包，不支持自动更新`,
    );
  }
  const current = await loadPolicies(stateDir);
  current[id] = { autoUpdate: Boolean(enabled) };
  await mkdir(stateDir, { recursive: true });
  const path = policyPath(stateDir);
  await writeFile(`${path}.tmp`, JSON.stringify(current, null, 2), { mode: 0o600 });
  await rename(`${path}.tmp`, path);
  return current;
}
