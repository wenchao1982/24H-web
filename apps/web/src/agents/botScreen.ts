/** M16 T23.18 Bot Screen：`groups.list` / L2 结果的容错解析（边缘功能，可降级）。 */

export interface BotScreen {
  name: string;
  status: string;
  detail: string;
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
    (Array.isArray(record.screens) && record.screens) ||
    (Array.isArray(record.bots) && record.bots) ||
    (Array.isArray(record.groups) && record.groups) ||
    (Array.isArray(record.items) && record.items) ||
    []
  );
}

export function normalizeBotScreens(payload: unknown): BotScreen[] {
  const out: BotScreen[] = [];
  const seen = new Set<string>();
  for (const item of pickList(payload)) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({ name, status: "", detail: "" });
      }
      continue;
    }
    const entry = asRecord(item);
    const name = str(entry.name) ?? str(entry.title) ?? str(entry.id) ?? str(entry.bot);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    out.push({
      name,
      status: str(entry.status) ?? str(entry.state) ?? "",
      detail: str(entry.detail) ?? str(entry.description) ?? "",
    });
  }
  return out;
}
