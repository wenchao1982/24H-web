/**
 * 群聊（L1 `groups.*`）响应规范化与请求构造。
 *
 * 对齐官方契约（`gateway-contract.generated.ts` / `tui_gateway/methods_groups.py`）：
 *   - `groups.capabilities` → `{driver, methods[], ...}`（`driver:false` 表示不可用）
 *   - `groups.create {room_id, name, members:[{member_id, profile, handle, display_name?}]}`
 *   - `groups.state {room_id}` → `{room, driver_status?}`
 *   - `groups.log {room_id, since_seq?}` → `{events:[{event_id, kind, actor, payload}], ...}`
 *   - `groups.send {room_id, event_id, payload:{text, thread_id}}`
 *   - `groups.rename {room_id, event_id, name}` / `groups.disband {room_id}`
 *
 * 官方 schema 仍在演进，解析保持宽松：兼容数组 / `{rooms}` / `{groups}` / snake_case / camelCase。
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
  /** 群内 @handle（`groups.create` 的 `handle`；`RoomMember.handle`）。 */
  handle?: string;
  /** 成员对应的 profile（本地 roster 与 members 的 `profile`）。 */
  profile?: string;
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

export interface GroupCapabilities {
  driver: boolean;
  methods: string[];
}

/** 官方 roster 约束：`hosted_room_discussion.validate_roster`（2–6 名本地 profile）。 */
export const MIN_GROUP_MEMBERS = 2;
export const MAX_GROUP_MEMBERS = 6;

/** `groups.create` 的成员入参（`RoomMemberInput`）。 */
export interface GroupMemberInput {
  member_id: string;
  profile: string;
  handle: string;
  display_name?: string;
}

/** `groups.capabilities` 响应是否表明群聊可用。 */
export function isGroupsSupported(payload: unknown): boolean {
  if (payload == null) {
    return true;
  }
  const source = asRecord(payload);
  return (
    source.supported !== false &&
    source.available !== false &&
    source.enabled !== false &&
    source.driver !== false
  );
}

/** 宽松解析 `groups.capabilities`。 */
export function normalizeCapabilities(payload: unknown): GroupCapabilities {
  const source = asRecord(payload);
  const methods = asArray(source.methods).filter(
    (method): method is string => typeof method === "string" && method.trim() !== "",
  );
  return { driver: source.driver !== false, methods };
}

export function normalizeMembers(value: unknown): GroupMember[] {
  const out: GroupMember[] = [];
  for (const item of asArray(value)) {
    if (typeof item === "string" && item.trim() !== "") {
      out.push({ id: item.trim(), name: item.trim() });
      continue;
    }
    const source = asRecord(item);
    const name = readString(
      source,
      "display_name",
      "displayName",
      "name",
      "member_id",
      "memberId",
      "handle",
      "id",
      "agent",
      "profile",
    );
    if (!name) {
      continue;
    }
    const id = readString(source, "member_id", "memberId", "id", "agent", "name") || name;
    const handle = readString(source, "handle");
    const profile = readString(source, "profile");
    out.push({
      id,
      name,
      ...(handle ? { handle } : {}),
      ...(profile ? { profile } : {}),
    });
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

/**
 * 解析 `groups.log` 事件流为 transcript（speaker + text）。
 * 只保留带 `payload.text` 的 `message.*` 事件；`turn.*` / `room.*` 等控制事件无文本，忽略。
 */
export function normalizeLogEvents(payload: unknown): GroupMessage[] {
  const source = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : asArray(source.events ?? source.messages ?? source.transcript);
  const out: GroupMessage[] = [];
  for (const item of list) {
    const event = asRecord(item);
    const body = asRecord(event.payload ?? event.data);
    const text = readString(body, "text", "content", "message", "body") || readString(event, "text");
    if (!text) {
      continue;
    }
    const actor = asRecord(event.actor);
    const kind = readString(actor, "kind");
    const memberId = readString(body, "member_id", "memberId");
    const sender =
      kind === "user"
        ? "我"
        : readString(actor, "display_name", "displayName", "name", "id") || memberId || "?";
    out.push({
      id: readString(event, "event_id", "eventId", "id", "seq") || `m${out.length}`,
      sender,
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

/** `groups.state` 响应 → 单个房间（`{room}` 或直接房间对象）。 */
export function normalizeRoomState(payload: unknown): GroupRoom | null {
  const source = asRecord(payload);
  return normalizeRoom(source.room ?? payload);
}

/**
 * profile 名称 → `groups.create` 成员入参。
 * `member_id`/`profile`/`handle` 均取 profile 名（唯一）；handle 不能占用 `@all`/`@everyone`。
 */
export function buildMemberInputs(
  profiles: { name: string; displayName?: string }[],
): GroupMemberInput[] {
  const seen = new Set<string>();
  const out: GroupMemberInput[] = [];
  for (const profile of profiles) {
    const name = profile.name.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const reserved = name.toLowerCase() === "all" || name.toLowerCase() === "everyone";
    const handle = reserved ? `${name}-member` : name;
    const displayName = (profile.displayName ?? "").trim();
    out.push({
      member_id: name,
      profile: name,
      handle,
      ...(displayName && displayName !== name ? { display_name: displayName } : {}),
    });
  }
  return out;
}

/** 生成官方 `_IDENTIFIER_RE`（`^[A-Za-z0-9][A-Za-z0-9._:-]*$`）安全的 id。 */
export function newIdentifier(prefix: string): string {
  const noise = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${noise}`;
}
