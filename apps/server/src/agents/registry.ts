import {
  CODING_AGENTS,
  type CodingAgentDefinition,
} from "./definitions";
import { withManagedPath, type CommandRunner } from "./runner";

export interface AgentStatus {
  id: string;
  name: string;
  vendor: string;
  bin: string;
  packageName: string | null;
  installable: boolean;
  installed: boolean;
  version: string | null;
}

export interface AgentsDeps {
  /** 受管安装目录（`npm -g --prefix`）。 */
  managedDir: string;
  /** 受管 bin 目录（提升到 PATH 最前）。 */
  managedBin: string;
  runner: CommandRunner;
}

/** 从 `--version` 输出里取出版本号（`1.2.3` / `1.2.3-beta.4`）。 */
export function parseVersion(text: string): string | null {
  const match = /(\d+\.\d+\.\d+(?:[-.][\w.]+)?)/.exec(text);
  return match ? match[1] : null;
}

/** 探测单个 agent：优先受管 bin，回退 PATH。 */
export async function detectAgent(
  definition: CodingAgentDefinition,
  deps: AgentsDeps,
): Promise<AgentStatus> {
  const env = withManagedPath(process.env, deps.managedBin);
  const result = await deps.runner(definition.bin, definition.versionArgs, {
    env,
    timeoutMs: 10_000,
  });
  return {
    id: definition.id,
    name: definition.name,
    vendor: definition.vendor,
    bin: definition.bin,
    packageName: definition.packageName,
    installable: Boolean(definition.packageName),
    installed: result.ok,
    version: result.ok ? parseVersion(`${result.stdout}\n${result.stderr}`) : null,
  };
}

export async function listAgents(deps: AgentsDeps): Promise<AgentStatus[]> {
  return Promise.all(CODING_AGENTS.map((definition) => detectAgent(definition, deps)));
}
