/** Agent / Profile 规范化（宽松解析官方 L1 `profiles.list` / `profiles.describe`）。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

function readBool(source: Record<string, unknown>, fallback: boolean, ...keys: string[]): boolean {
  for (const key of keys) {
    if (typeof source[key] === "boolean") {
      return source[key] as boolean;
    }
  }
  return fallback;
}

function readNumber(source: Record<string, unknown>, fallback: number, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

/** 选中 agent 的运行状态（由 worker/last_session 推导，不臆造字段）。 */
export type AgentStatus = "active" | "idle";

export interface AgentSummary {
  name: string;
  displayName: string;
  description: string;
  provider: string;
  model: string;
  isDefault: boolean;
  skillCount: number;
  hasAvatar: boolean;
  status: AgentStatus;
  lastActive: number;
}

export interface AgentSkillRef {
  name: string;
  enabled: boolean;
}

export interface AgentMcpRef {
  name: string;
  enabled: boolean;
  transport: string;
}

export interface AgentDetail {
  name: string;
  displayName: string;
  description: string;
  soul: string;
  provider: string;
  model: string;
  skills: AgentSkillRef[];
  mcpServers: AgentMcpRef[];
  /** 未启用的 skill 名（`profiles.configure` 的 disabled_skills 入参）。 */
  disabledSkills: string[];
}

/** 头像占位：名称首字符（大写；中英文皆可）。 */
export function agentInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}

/** 给 BFF 路径追加 `?profile=`（代理据此做租户守卫并作用到该 profile）。 */
export function withProfile(path: string, profile?: string | null): string {
  if (!profile) {
    return path;
  }
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}profile=${encodeURIComponent(profile)}`;
}

/** `profiles.list` → 列表。兼容 `{profiles:[...]}` / `[...]`。 */
export function normalizeAgentList(payload: unknown): AgentSummary[] {
  const raw = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.profiles)
      ? raw.profiles
      : [];
  const out: AgentSummary[] = [];
  for (const item of list) {
    const source = asRecord(item);
    const name = readString(source, "name");
    if (!name) {
      continue;
    }
    const worker = asRecord(source.worker_session);
    out.push({
      name,
      displayName: readString(source, "display_name", "displayName") || name,
      description: readString(source, "description"),
      provider: readString(source, "provider"),
      model: readString(source, "model"),
      isDefault: readBool(source, false, "is_default", "isDefault"),
      skillCount: readNumber(source, 0, "skill_count", "skillCount"),
      hasAvatar: readBool(source, false, "has_avatar", "hasAvatar"),
      status: Object.keys(worker).length > 0 ? "active" : "idle",
      lastActive: readNumber(asRecord(source.last_session), 0, "last_active", "lastActive"),
    });
  }
  return out;
}

function normalizeSkills(payload: unknown): AgentSkillRef[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const out: AgentSkillRef[] = [];
  for (const item of payload) {
    const source = asRecord(item);
    const name = readString(source, "name");
    if (!name) {
      continue;
    }
    out.push({ name, enabled: readBool(source, true, "enabled") });
  }
  return out;
}

function normalizeMcpServers(payload: unknown): AgentMcpRef[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const out: AgentMcpRef[] = [];
  for (const item of payload) {
    const source = asRecord(item);
    const name = readString(source, "name");
    if (!name) {
      continue;
    }
    out.push({
      name,
      enabled: readBool(source, true, "enabled"),
      transport: readString(source, "transport"),
    });
  }
  return out;
}

/** `profiles.describe` → 详情。model 兼容 `{provider,default}` 与裸字符串。 */
export function normalizeAgentDetail(payload: unknown): AgentDetail {
  const source = asRecord(payload);
  const name = readString(source, "name");
  const modelRaw = source.model;
  const modelRecord = asRecord(modelRaw);
  const skills = normalizeSkills(source.skills);
  const explicitDisabled = Array.isArray(source.disabled_skills)
    ? source.disabled_skills
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry !== "")
    : null;
  const disabledSkills =
    explicitDisabled ?? skills.filter((skill) => !skill.enabled).map((skill) => skill.name);

  return {
    name,
    displayName: readString(source, "display_name", "displayName") || name,
    description: readString(source, "description"),
    soul: typeof source.soul === "string" ? source.soul : "",
    provider: readString(source, "provider") || readString(modelRecord, "provider"),
    model: readString(source, "model") || readString(modelRecord, "default", "model"),
    skills,
    mcpServers: normalizeMcpServers(source.mcp_servers),
    disabledSkills,
  };
}
