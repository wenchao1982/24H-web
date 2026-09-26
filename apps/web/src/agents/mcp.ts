/** 智能体页「MCP」视图的规范化模型（宽松解析官方 `/api/mcp/servers`）。 */

export interface McpServerEntry {
  name: string;
  /** stdio 命令或 http 地址，用于列表展示。 */
  command: string;
  enabled: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeMcpServers(payload: unknown): McpServerEntry[] {
  const raw = asRecord(payload);
  const value = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.servers)
      ? raw.servers
      : raw.servers && typeof raw.servers === "object"
        ? Object.entries(raw.servers as Record<string, unknown>).map(([name, entry]) => ({
            name,
            ...(entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}),
          }))
        : [];

  const out: McpServerEntry[] = [];
  for (const item of value) {
    const source = asRecord(item);
    const name = typeof source.name === "string" ? source.name : "";
    if (!name) {
      continue;
    }
    const command =
      typeof source.command === "string"
        ? source.command
        : typeof source.url === "string"
          ? source.url
          : "";
    const disabled = source.disabled === true;
    const enabled = typeof source.enabled === "boolean" ? source.enabled : !disabled;
    out.push({ name, command, enabled });
  }
  return out;
}
