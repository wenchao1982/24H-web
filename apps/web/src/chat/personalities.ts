/**
 * M16 T23.14 Personality 预设：`slash.exec {command:'/personality'}` 结果的容错解析。
 * list 动作用 `args:"list"`，应用用 `args:"<name>"`。
 */

export interface PersonalityPreset {
  name: string;
  description: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  const record = asRecord(payload);
  return (
    (Array.isArray(record.presets) && record.presets) ||
    (Array.isArray(record.personalities) && record.personalities) ||
    (Array.isArray(record.items) && record.items) ||
    (Array.isArray(record.list) && record.list) ||
    []
  );
}

/** 解析人格预设列表。 */
export function normalizePersonalities(payload: unknown): PersonalityPreset[] {
  const out: PersonalityPreset[] = [];
  const seen = new Set<string>();
  for (const item of pickList(payload)) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({ name, description: "" });
      }
      continue;
    }
    const entry = asRecord(item);
    const source = asRecord(entry.preset);
    const name =
      str(entry.name) ?? str(entry.id) ?? str(entry.preset) ?? str(source.name) ?? str(entry.label);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    out.push({
      name,
      description: str(entry.description) ?? str(entry.summary) ?? str(entry.detail) ?? "",
    });
  }
  return out;
}

/** list 动作参数。 */
export function listPersonalityArgs(): { command: string; args: string } {
  return { command: "/personality", args: "list" };
}

/** 应用某预设的参数。 */
export function setPersonalityArgs(name: string): { command: string; args: string } {
  return { command: "/personality", args: name };
}
