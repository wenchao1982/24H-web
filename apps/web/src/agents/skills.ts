/** 智能体页技能视图的规范化模型（对齐官方 `/api/skills` 契约的宽松解析）。 */

export interface SkillEntry {
  /** 技能标识（官方一般用 name）。 */
  name: string;
  description: string;
  /** 分组类别，缺省归入「未分类」。 */
  category: string;
  enabled: boolean;
}

export const UNCATEGORIZED = "未分类";

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

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSkill(raw: unknown): SkillEntry | null {
  const source = asRecord(raw);
  const name = readString(source, "name", "id", "skill", "slug");
  if (!name) {
    return null;
  }
  const disabled = readBoolean(source, "disabled", false);
  const enabled = readBoolean(source, "enabled", !disabled);
  return {
    name,
    description: readString(source, "description", "summary", "desc"),
    category: readString(source, "category", "category_name", "group") || UNCATEGORIZED,
    enabled,
  };
}

/** 从 `{ skills: [...] }` / `[...]` 等形态提取技能列表。 */
export function normalizeSkills(payload: unknown): SkillEntry[] {
  const raw = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.skills)
      ? raw.skills
      : Array.isArray(raw.items)
        ? raw.items
        : [];
  return list
    .map(normalizeSkill)
    .filter((entry): entry is SkillEntry => entry !== null);
}

export interface SkillGroup {
  category: string;
  skills: SkillEntry[];
}

/** 按类别分组，保持首次出现顺序，未分类排最后。 */
export function groupByCategory(skills: SkillEntry[]): SkillGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, SkillEntry[]>();
  for (const skill of skills) {
    if (!buckets.has(skill.category)) {
      buckets.set(skill.category, []);
      order.push(skill.category);
    }
    buckets.get(skill.category)!.push(skill);
  }
  order.sort((a, b) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return 0;
  });
  return order.map((category) => ({ category, skills: buckets.get(category)! }));
}
