/**
 * 群聊（L1 `groups.*`）响应规范化。
 *
 * 官方 `groups.*` schema 尚未冻结，这里做宽松解析：兼容数组 / `{rooms}` / `{groups}`，
 * 以及 snake_case / camelCase 字段，避免因字段差异崩溃。
 */

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

export interface GroupMember {
  id: string;
  name: string;
}

export interface GroupMessage {
  id: string;
  sender: string;
  text: string;
}

export interface GroupRoom {
  id: string;
  name: string;
  members: GroupMember[];
  latest: string;
  messages: GroupMessage[];
}

/** `groups.capabilities` 响应是否表明群聊可用。 */
export function isGroupsSupported(payload: unknown): boolean {
  if (payload == null) {
    return true;
  }
  const source = asRecord(payload);
  return source.supported !== false && source.available !== false && source.enabled !== false;
}

export function normalizeMembers(value: unknown): GroupMember[] {
  const out: GroupMember[] = [];
  for (const item of asArray(value)) {
    if (typeof item === "string" && item.trim() !== "") {
      out.push({ id: item.trim(), name: item.trim() });
      continue;
    }
    const source = asRecord(item);
    const name = readString(source, "name", "display_name", "displayName", "id", "agent");
    if (name) {
      out.push({ id: readString(source, "id", "agent", "name") || name, name });
    }
  }
  return out;
}

export function normalizeMessages(value: unknown): GroupMessage[] {
  const source = asRecord(value);
  const list = Array.isArray(value)
    ? value
    : asArray(source.messages ?? source.transcript ?? source.history);
  const out: GroupMessage[] = [];
  for (const item of list) {
    const source = asRecord(item);
    const text = readString(source, "text", "content", "message", "body");
    if (!text) {
      continue;
    }
    out.push({
      id: readString(source, "id", "message_id", "messageId") || `m${out.length}`,
      sender: readString(source, "sender", "author", "from", "role", "name") || "?",
      text,
    });
  }
  return out;
}

function normalizeRoom(item: unknown): GroupRoom | null {
  const source = asRecord(item);
  const id = readString(source, "id", "room_id", "roomId", "group_id", "groupId", "name");
  if (!id) {
    return null;
  }
  const messages = normalizeMessages(source.messages ?? source.transcript ?? source.history);
  return {
    id,
    name: readString(source, "name", "title", "display_name", "displayName") || id,
    members: normalizeMembers(source.members ?? source.participants),
    latest: readString(source, "latest", "last_message", "lastMessage", "preview"),
    messages,
  };
}

/** 列表响应兼容 `[...]` / `{rooms:[...]}` / `{groups:[...]}`。 */
export function normalizeRooms(payload: unknown): GroupRoom[] {
  const source = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : asArray(source.rooms).length > 0
      ? asArray(source.rooms)
      : asArray(source.groups);
  const out: GroupRoom[] = [];
  for (const item of list) {
    const room = normalizeRoom(item);
    if (room) {
      out.push(room);
    }
  }
  return out;
}
