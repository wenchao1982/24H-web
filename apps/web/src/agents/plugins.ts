/** 智能体页「插件」视图模型：解析 L1 `plugins.manage` 的返回。 */

export interface PluginEntry {
  name: string;
  version: string;
  enabled: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizePlugins(payload: unknown): PluginEntry[] {
  const raw = asRecord(payload);
  const value = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.plugins)
      ? raw.plugins
      : [];

  const out: PluginEntry[] = [];
  for (const item of value) {
    const source = asRecord(item);
    const name = typeof source.name === "string" ? source.name : "";
    if (!name) {
      continue;
    }
    out.push({
      name,
      version: typeof source.version === "string" ? source.version : "",
      enabled: typeof source.enabled === "boolean" ? source.enabled : true,
    });
  }
  return out;
}
