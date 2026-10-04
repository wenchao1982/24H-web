/**
 * 外部 agent 运行时定义（M22）。
 *
 * 白名单：只有这里登记的 `packageName` 才会被 BFF 原生安装（`npm -g --prefix`）。
 * `packageName: null` = 暂不支持安装（占位，如 Pi / Grok，待官方安装源确认）。
 */
export interface CodingAgentDefinition {
  id: string;
  name: string;
  vendor: string;
  /** npm 包名；`null` = 未支持原生安装。 */
  packageName: string | null;
  /** CLI 二进制名（探测版本用）。 */
  bin: string;
  /** 版本探测参数。 */
  versionArgs: string[];
  installKind: "npm-global";
  /** 可选：固定版本（红线：白名单 + 固定版本）。缺省安装 `@latest` 并记录实际版本。 */
  pinnedVersion?: string;
}

export const CODING_AGENTS: CodingAgentDefinition[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    packageName: "@anthropic-ai/claude-code",
    bin: "claude",
    versionArgs: ["--version"],
    installKind: "npm-global",
  },
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    packageName: "@openai/codex",
    bin: "codex",
    versionArgs: ["--version"],
    installKind: "npm-global",
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "OpenCode",
    packageName: "opencode-ai",
    bin: "opencode",
    versionArgs: ["--version"],
    installKind: "npm-global",
  },
  {
    id: "pi",
    name: "Pi",
    vendor: "Pi",
    packageName: null,
    bin: "pi",
    versionArgs: ["--version"],
    installKind: "npm-global",
  },
  {
    id: "grok",
    name: "Grok CLI",
    vendor: "xAI",
    packageName: null,
    bin: "grok",
    versionArgs: ["--version"],
    installKind: "npm-global",
  },
];

export function findDefinition(id: string): CodingAgentDefinition | undefined {
  return CODING_AGENTS.find((definition) => definition.id === id);
}
