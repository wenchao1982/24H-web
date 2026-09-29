/**
 * `/api/auth/me` → 可选智能体白名单（TASK-007 / REQ-002）。
 *
 * **只认 `me.profiles`**（字符串数组）；缺失 / 非数组 → `[]`。
 * **绝不回退** `profiles.list`（那是全量，非调用者白名单）。
 */

export interface AgentOption {
  name: string;
  isDefault: boolean;
  avatarUrl?: string;
}

export function normalizeAgentOptions(
  me: { profiles?: unknown; default_profile?: unknown } | null | undefined,
): AgentOption[] {
  const record =
    me !== null && typeof me === "object" ? (me as Record<string, unknown>) : null;
  const rawProfiles = record?.profiles;
  if (!Array.isArray(rawProfiles)) {
    return [];
  }

  const names: string[] = [];
  const seen = new Set<string>();
  for (const entry of rawProfiles) {
    if (typeof entry !== "string") {
      continue;
    }
    const name = entry.trim();
    if (name === "" || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  if (names.length === 0) {
    return [];
  }

  const rawDefault = record?.default_profile;
  const defaultName = typeof rawDefault === "string" ? rawDefault.trim() : "";
  const defaultIndex = defaultName !== "" ? names.indexOf(defaultName) : -1;
  const resolvedDefault = defaultIndex >= 0 ? defaultIndex : 0;

  return names.map((name, index) => ({ name, isDefault: index === resolvedDefault }));
}
