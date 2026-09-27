/** Webhooks（L2 `/api/webhooks*`）响应规范化与请求体构造。 */

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

export interface Webhook {
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
}

export function normalizeEvents(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  }
  return [];
}

/** 列表响应兼容 `[...]` / `{webhooks:[...]}` / `{items:[...]}`。 */
export function normalizeWebhooks(payload: unknown): Webhook[] {
  const source = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : asArray(source.webhooks).length > 0
      ? asArray(source.webhooks)
      : asArray(source.items);
  const out: Webhook[] = [];
  for (const item of list) {
    const entry = asRecord(item);
    const name = readString(entry, "name", "id", "hook");
    if (!name) {
      continue;
    }
    out.push({
      name,
      url: readString(entry, "url", "target", "callback"),
      events: normalizeEvents(entry.events ?? entry.event_types ?? entry.eventTypes),
      enabled: entry.enabled !== false && entry.active !== false,
    });
  }
  return out;
}

/** 由表单构造创建/更新 body；空事件数组省略。 */
export function buildWebhookBody(input: {
  name: string;
  url: string;
  events: string[];
}): { name: string; url: string; events?: string[] } {
  const body: { name: string; url: string; events?: string[] } = {
    name: input.name,
    url: input.url,
  };
  if (input.events.length > 0) {
    body.events = input.events;
  }
  return body;
}
