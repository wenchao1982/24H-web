/** M16 T23.15 Plugin Catalog：`plugins.manage {action:'catalog'}` 结果解析。 */

export interface PluginCatalogEntry {
  name: string;
  description: string;
  version: string;
  installed: boolean;
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
    (Array.isArray(record.plugins) && record.plugins) ||
    (Array.isArray(record.catalog) && record.catalog) ||
    (Array.isArray(record.items) && record.items) ||
    []
  );
}

export function normalizePluginCatalog(payload: unknown): PluginCatalogEntry[] {
  const out: PluginCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const item of pickList(payload)) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({ name, description: "", version: "", installed: false });
      }
      continue;
    }
    const entry = asRecord(item);
    const name = str(entry.name) ?? str(entry.id) ?? str(entry.plugin);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    out.push({
      name,
      description: str(entry.description) ?? str(entry.summary) ?? "",
      version: str(entry.version) ?? "",
      installed: entry.installed === true || entry.enabled === true,
    });
  }
  return out;
}
