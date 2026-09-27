/** 子代理观测（L1 `subagent.*` / `delegation.*`）响应规范化。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

export interface Subagent {
  id: string;
  name: string;
  status: string;
  latest: string;
}

/** 列表响应兼容 `[...]` / `{subagents:[...]}` / `{children:[...]}`。 */
export function normalizeSubagents(payload: unknown): Subagent[] {
  const source = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : asArray(source.subagents).length > 0
      ? asArray(source.subagents)
      : asArray(source.children);
  const out: Subagent[] = [];
  for (const item of list) {
    const entry = asRecord(item);
    const id = readString(entry, "id", "subagent_id", "subagentId", "agent_id", "agentId", "name");
    if (!id) {
      continue;
    }
    out.push({
      id,
      name: readString(entry, "name", "label", "agent", "title") || id,
      status: readString(entry, "status", "state", "phase"),
      latest: readString(entry, "latest", "last_message", "lastMessage", "summary", "preview"),
    });
  }
  return out;
}

/** `subagent.tail` 响应可能是字符串或 `{text|tail|content|output}`。 */
export function normalizeTail(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  return readString(asRecord(payload), "text", "tail", "content", "output");
}

/** `delegation.status` 是否处于暂停。 */
export function normalizePaused(payload: unknown): boolean {
  const source = asRecord(payload);
  if (typeof source.paused === "boolean") {
    return source.paused;
  }
  return source.status === "paused";
}
