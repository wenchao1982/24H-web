import { api } from "../api/client";

/** 与 BFF `GET /api/skill-uis` 对齐（见 apps/server/src/skillui/types.ts）。 */
export interface SkillUiInfo {
  id: string;
  title: string;
  entry: string;
  host: "iframe";
  capabilities: string[];
  permissions: string[];
  size?: { width?: number; height?: number };
}

export async function listSkillUis(): Promise<SkillUiInfo[]> {
  const data = await api<{ skills: SkillUiInfo[] }>("/api/skill-uis");
  return Array.isArray(data.skills) ? data.skills : [];
}

/** 经 BFF broker 调用白名单能力；失败抛 `ApiError`。 */
export async function invokeSkill(
  skillId: string,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const data = await api<{ ok: boolean; result?: unknown }>("/api/skill-host/invoke", {
    method: "POST",
    body: JSON.stringify({ skillId, method, params }),
  });
  return data.result;
}
