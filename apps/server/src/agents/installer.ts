import { findDefinition } from "./definitions";
import { detectAgent, parseVersion, type AgentStatus, type AgentsDeps } from "./registry";
import { withManagedPath } from "./runner";
import { ApiError } from "../http/errors";

const INSTALL_TIMEOUT_MS = 300_000;
const VERSION_TIMEOUT_MS = 60_000;

export interface UpdateCheck {
  id: string;
  installed: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}

function requireDefinition(id: string) {
  const definition = findDefinition(id);
  if (!definition) {
    throw new ApiError(404, "AGENT_UNKNOWN", `未知外部 agent：${id}`);
  }
  return definition;
}

/** 原生安装：`npm install -g --prefix <受管目录> <packageName>[@版本]`。 */
export async function installAgent(id: string, deps: AgentsDeps): Promise<AgentStatus> {
  const definition = requireDefinition(id);
  if (!definition.packageName) {
    throw new ApiError(400, "AGENT_NOT_INSTALLABLE", `${definition.name} 暂不支持原生安装`);
  }
  const spec = definition.pinnedVersion
    ? `${definition.packageName}@${definition.pinnedVersion}`
    : `${definition.packageName}@latest`;
  const env = withManagedPath(process.env, deps.managedBin);
  const result = await deps.runner(
    "npm",
    ["install", "-g", "--prefix", deps.managedDir, spec],
    { env, timeoutMs: INSTALL_TIMEOUT_MS },
  );
  if (!result.ok) {
    throw new ApiError(
      502,
      "AGENT_INSTALL_FAILED",
      `安装失败：${result.stderr.trim() || result.stdout.trim() || "未知错误"}`,
    );
  }
  return detectAgent(definition, deps);
}

export async function uninstallAgent(id: string, deps: AgentsDeps): Promise<AgentStatus> {
  const definition = requireDefinition(id);
  if (!definition.packageName) {
    throw new ApiError(400, "AGENT_NOT_INSTALLABLE", `${definition.name} 暂不支持卸载`);
  }
  const env = withManagedPath(process.env, deps.managedBin);
  const result = await deps.runner(
    "npm",
    ["uninstall", "-g", "--prefix", deps.managedDir, definition.packageName],
    { env, timeoutMs: VERSION_TIMEOUT_MS },
  );
  if (!result.ok) {
    throw new ApiError(
      502,
      "AGENT_UNINSTALL_FAILED",
      `卸载失败：${result.stderr.trim() || result.stdout.trim() || "未知错误"}`,
    );
  }
  return detectAgent(definition, deps);
}

/** 检查更新：`npm view <pkg> version` 对比已装版本。 */
export async function checkAgentUpdate(id: string, deps: AgentsDeps): Promise<UpdateCheck> {
  const definition = requireDefinition(id);
  const status = await detectAgent(definition, deps);
  if (!definition.packageName) {
    return {
      id,
      installed: status.installed,
      currentVersion: status.version,
      latestVersion: null,
      updateAvailable: false,
    };
  }
  const env = withManagedPath(process.env, deps.managedBin);
  const result = await deps.runner("npm", ["view", definition.packageName, "version"], {
    env,
    timeoutMs: VERSION_TIMEOUT_MS,
  });
  const latestVersion = result.ok ? parseVersion(result.stdout) : null;
  const updateAvailable = Boolean(
    status.installed && latestVersion && status.version && latestVersion !== status.version,
  );
  return {
    id,
    installed: status.installed,
    currentVersion: status.version,
    latestVersion,
    updateAvailable,
  };
}
