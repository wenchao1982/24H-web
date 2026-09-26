/** 智能体页「工具 / Toolsets」视图的规范化模型（宽松解析官方 `/api/tools/toolsets`）。 */

export interface ToolsetEntry {
  name: string;
  description: string;
  enabled: boolean;
}

export function normalizeToolsets(payload: unknown): ToolsetEntry[] {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const value = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.toolsets)
      ? raw.toolsets
      : raw.toolsets && typeof raw.toolsets === "object"
        ? Object.entries(raw.toolsets as Record<string, unknown>).map(([name, entry]) => ({
            name,
            ...(entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}),
          }))
        : [];

  const out: ToolsetEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const source = item as Record<string, unknown>;
    const name =
      typeof source.name === "string"
        ? source.name
        : typeof source.id === "string"
          ? source.id
          : "";
    if (!name) {
      continue;
    }
    const description =
      typeof source.description === "string"
        ? source.description
        : typeof source.summary === "string"
          ? source.summary
          : "";
    const disabled = source.disabled === true;
    const enabled = typeof source.enabled === "boolean" ? source.enabled : !disabled;
    out.push({ name, description, enabled });
  }
  return out;
}

/** 把配置响应渲染成只读文本（未知结构统一 JSON 美化）。 */
export function formatToolsetConfig(payload: unknown): string {
  if (payload == null) {
    return "（无配置）";
  }
  if (typeof payload === "string") {
    return payload;
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}
