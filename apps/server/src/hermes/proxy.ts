import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import WebSocket, { type RawData } from "ws";
import type { Db } from "../db";
import { logAudit } from "../audit/repo";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "./client";
import { resolveTarget } from "./connections";
import { listUserProfiles } from "../users/repo";
import {
  guardClientFrame,
  invalidAttachmentFrame,
  invalidFrame,
  profileForbiddenFrame,
} from "./frameGuard";

export interface HermesWsOptions {
  db: Db;
  defaultBaseUrl: string;
}

interface PendingFrame {
  data: RawData | string;
  isBinary: boolean;
  bytes: number;
}

/**
 * REQ-018 / REQ-018b：`maxPayload`、队列**条数**上限与**累计字节**预算。
 *
 * 两个上限**各自独立**、分别防御不同形态的内存放大（命中任一即拒新帧）：
 * - `WS_MAX_PENDING_COUNT`：防**大量小帧**堆积。冷启动（token 拉取期间，约数百 ms）
 *   客户端允许合理突发小帧；早期实现曾把 `WS_QUEUE_FACTOR` 兼作条数上限 → 第 5 帧
 *   即被拒（功能回归，已于本轮解耦修复）。
 * - `WS_MAX_PENDING_BYTES = WS_QUEUE_FACTOR × WS_MAX_PAYLOAD`：防**少量大帧**堆内存；
 *   `K = 4 × 16 MiB = 64 MiB` 为**单连接**内存上限。
 */
export const WS_MAX_PAYLOAD = 16 * 1024 * 1024; // 16 MiB
export const WS_QUEUE_FACTOR = 4;
export const WS_MAX_PENDING_COUNT = 256;
export const WS_MAX_PENDING_BYTES = WS_QUEUE_FACTOR * WS_MAX_PAYLOAD; // 64 MiB

/**
 * 上行队列（`outbound`：上游 → 客户端）的**对称防御**上限。
 *
 * `outbound` 仅在客户端 socket 尚未 `OPEN` 时累积，窗口极短且帧来自**上游**
 * （故单帧已受上游侧 `maxPayload = WS_MAX_PAYLOAD` 约束）。此处仍补上**条数 +
 * 累计字节**双上限，与 `pending` 保持对称，避免极端竞态下无界堆积：
 * - `WS_MAX_OUTBOUND_COUNT`：防大量小帧（与 `WS_MAX_PENDING_COUNT` 对齐）。
 * - `WS_MAX_OUTBOUND_BYTES`：防少量大帧（与 `WS_MAX_PENDING_BYTES` 对齐，64 MiB）。
 */
export const WS_MAX_OUTBOUND_COUNT = 256;
export const WS_MAX_OUTBOUND_BYTES = WS_QUEUE_FACTOR * WS_MAX_PAYLOAD; // 64 MiB

/**
 * `outbound` 超限判定（纯函数，便于单测）：给定**已入队条数**与**拟入队后累计字节**，
 * 命中任一上限即拒绝。`bytes` 为**包含新帧**的预期总量（调用方负责先累加）。
 */
export function shouldRejectOutbound(count: number, bytes: number): boolean {
  return count >= WS_MAX_OUTBOUND_COUNT || bytes > WS_MAX_OUTBOUND_BYTES;
}

/** 响应过滤待决表上限（REQ-015 兜底：伪造 id / 并发洪泛）。 */
const MAX_PENDING_PROFILE_READS = 256;
const PENDING_PROFILE_READ_TTL_MS = 60_000;

/** R24：per-connection 会话归属表上限与 TTL（防内存泄漏，超限 fail-closed）。 */
const MAX_SESSION_OWNERS = 512;
const SESSION_OWNER_TTL_MS = 10 * 60_000;

/** 会回传 runtime/stored 会话 id 的建/附会话 RPC（用于填充归属表）。 */
const SESSION_OWNERSHIP_METHODS: ReadonlySet<string> = new Set([
  "session.create",
  "session.resume",
  "session.activate",
]);

interface PendingProfileRead {
  userId: number;
  kind: "list" | "describe";
  at: number;
}

function readConnectionId(request: FastifyRequest): string | null {
  const query = request.query as Record<string, unknown> | undefined;
  const value = query?.connection;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function rawToString(data: RawData): string {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return Buffer.from(data).toString("utf8");
}

function frameBytes(data: RawData | string): number {
  if (typeof data === "string") {
    return Buffer.byteLength(data);
  }
  if (Buffer.isBuffer(data)) {
    return data.byteLength;
  }
  if (Array.isArray(data)) {
    return data.reduce((sum, part) => sum + part.byteLength, 0);
  }
  return data.byteLength;
}

function readId(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  return null;
}

/**
 * 记录/过滤 `profiles.list` 与 `profiles.describe` 的响应（REQ-015）。
 *
 * - 仅非 `super_admin` 记录与过滤
 * - 上游错误帧（`{id, error}`）原样透传
 * - 仅「成功但结构不符」fail-closed（不下发全量）
 */
function handleUpstreamProfileRead(
  db: Db,
  pending: Map<string, PendingProfileRead>,
  frame: unknown,
): { action: "passthrough" } | { action: "replace"; frame: unknown } {
  if (typeof frame !== "object" || frame === null || Array.isArray(frame)) {
    return { action: "passthrough" };
  }
  const record = frame as Record<string, unknown>;
  const key = readId(record.id);
  if (key === null) {
    return { action: "passthrough" };
  }
  const entry = pending.get(key);
  if (!entry) {
    return { action: "passthrough" };
  }
  pending.delete(key);

  // 上游错误帧原样透传（PR-008）。
  if (record.error !== undefined && record.error !== null) {
    return { action: "passthrough" };
  }

  const { profiles } = listUserProfiles(db, entry.userId);
  const allowed = new Set(profiles);

  if (entry.kind === "describe") {
    const result = record.result;
    if (typeof result === "object" && result !== null && !Array.isArray(result)) {
      const name = (result as Record<string, unknown>).name;
      if (typeof name === "string" && !allowed.has(name)) {
        return { action: "replace", frame: forbiddenFor(idOf(record.id)) };
      }
    }
    return { action: "passthrough" };
  }

  // profiles.list：成功但结构不符 → fail-closed。
  const result = record.result;
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return { action: "replace", frame: failClosedFrame(idOf(record.id)) };
  }
  const rows = (result as Record<string, unknown>).profiles;
  if (!Array.isArray(rows)) {
    return { action: "replace", frame: failClosedFrame(idOf(record.id)) };
  }
  const filtered = rows.filter((row) => {
    if (typeof row !== "object" || row === null) {
      return false;
    }
    const name = (row as Record<string, unknown>).name;
    return typeof name === "string" && allowed.has(name);
  });
  return {
    action: "replace",
    frame: { ...record, result: { ...(result as Record<string, unknown>), profiles: filtered } },
  };
}

function idOf(value: unknown): number | string | null {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return null;
}

function forbiddenFor(id: number | string | null): unknown {
  return JSON.parse(profileForbiddenFrame(id));
}

function failClosedFrame(id: number | string | null): unknown {
  return JSON.parse(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: 500, message: "profiles 过滤失败", data: { code: "PROFILES_FILTER_FAILED" } },
    }),
  );
}

/**
 * Authenticate the upgrade request with the BFF session cookie, then open a
 * server-to-server WebSocket to Hermes and pipe frames both ways.
 */
async function bridge(
  socket: WebSocket,
  request: FastifyRequest,
  options: HermesWsOptions,
): Promise<void> {
  const db = options.db;
  const user = request.user;
  const userRef = { id: user?.id ?? -1, role: user?.role ?? "" };
  const isSuperAdmin = user?.role === "super_admin";

  const pending: PendingFrame[] = [];
  const outbound: PendingFrame[] = [];
  let pendingBytes = 0;
  let outboundBytes = 0;
  const pendingProfileReads = new Map<string, PendingProfileRead>();
  // R24：per-connection 会话归属（session_id → profile）与其待决建/附请求（requestId → profile）。
  const sessionOwners = new Map<string, string>();
  const sessionOwnerAt = new Map<string, number>();
  const pendingSessionOwners = new Map<string, string>();
  const pendingSessionOwnerAt = new Map<string, number>();
  let upstreamSocket: WebSocket | null = null;

  const sendToClient = (text: string) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(text);
    }
  };

  const sendUpstream = (text: string) => {
    if (upstreamSocket && upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.send(text);
      return true;
    }
    return false;
  };

  const recordProfileReads = (parsed: unknown) => {
    if (isSuperAdmin) {
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const method = record.method;
      if (method !== "profiles.list" && method !== "profiles.describe") {
        continue;
      }
      const key = readId(record.id);
      if (key === null) {
        continue;
      }
      if (pendingProfileReads.size >= MAX_PENDING_PROFILE_READS) {
        continue;
      }
      pendingProfileReads.set(key, {
        userId: userRef.id,
        kind: method === "profiles.list" ? "list" : "describe",
        at: Date.now(),
      });
    }
  };

  const pruneProfileReads = () => {
    const now = Date.now();
    for (const [key, entry] of pendingProfileReads) {
      if (now - entry.at > PENDING_PROFILE_READ_TTL_MS) {
        pendingProfileReads.delete(key);
      }
    }
  };

  // R24：归属表与待决表按 TTL 清理；超限时新条目直接丢弃（fail-closed：未知会话将被拒绝）。
  const pruneSessionOwners = () => {
    const now = Date.now();
    for (const [key, at] of sessionOwnerAt) {
      if (now - at > SESSION_OWNER_TTL_MS) {
        sessionOwners.delete(key);
        sessionOwnerAt.delete(key);
      }
    }
    for (const [key, at] of pendingSessionOwnerAt) {
      if (now - at > SESSION_OWNER_TTL_MS) {
        pendingSessionOwners.delete(key);
        pendingSessionOwnerAt.delete(key);
      }
    }
  };

  const rememberSessionOwner = (sessionId: string, profile: string) => {
    if (sessionOwners.size >= MAX_SESSION_OWNERS && !sessionOwners.has(sessionId)) {
      return;
    }
    sessionOwners.set(sessionId, profile);
    sessionOwnerAt.set(sessionId, Date.now());
  };

  /** 转发建/附会话请求前，记下 `requestId → profile`（回包到达时据以登记归属）。 */
  const recordSessionRequest = (parsed: unknown) => {
    if (isSuperAdmin) {
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }
      const record = item as Record<string, unknown>;
      if (typeof record.method !== "string" || !SESSION_OWNERSHIP_METHODS.has(record.method)) {
        continue;
      }
      const key = readId(record.id);
      if (key === null || pendingSessionOwners.size >= MAX_SESSION_OWNERS) {
        continue;
      }
      const params = record.params;
      const profile =
        typeof params === "object" && params !== null && !Array.isArray(params)
          ? (params as Record<string, unknown>).profile
          : undefined;
      if (typeof profile !== "string" || profile.trim() === "") {
        continue;
      }
      pendingSessionOwners.set(key, profile.trim());
      pendingSessionOwnerAt.set(key, Date.now());
    }
  };

  /** 上游响应：把 runtime/stored id 登记到发起该请求的 profile；`session.list` 行若有 `profile` 也登记。 */
  const applySessionOwnerResponse = (parsed: unknown) => {
    if (isSuperAdmin) {
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const result = record.result;
      if (typeof result !== "object" || result === null || Array.isArray(result)) {
        continue;
      }
      const resultRecord = result as Record<string, unknown>;

      if (Array.isArray(resultRecord.sessions)) {
        for (const row of resultRecord.sessions) {
          if (typeof row !== "object" || row === null || Array.isArray(row)) {
            continue;
          }
          const rowRecord = row as Record<string, unknown>;
          const id = rowRecord.id;
          const profile = rowRecord.profile;
          if (typeof id === "string" && id !== "" && typeof profile === "string" && profile !== "") {
            rememberSessionOwner(id, profile);
          }
        }
      }

      const key = readId(record.id);
      if (key === null) {
        continue;
      }
      const owner = pendingSessionOwners.get(key);
      if (owner === undefined) {
        continue;
      }
      pendingSessionOwners.delete(key);
      pendingSessionOwnerAt.delete(key);
      const runtime = resultRecord.session_id;
      const stored = resultRecord.stored_session_id ?? resultRecord.session_key;
      if (typeof runtime === "string" && runtime !== "") {
        rememberSessionOwner(runtime, owner);
      }
      if (typeof stored === "string" && stored !== "") {
        rememberSessionOwner(stored, owner);
      }
    }
  };

  /**
   * 单次解析上行帧，供「profile 读取登记」与「session 归属登记」复用
   * （避免对同一大帧重复 `JSON.parse`）。
   */
  const recordClientRequest = (text: string) => {
    if (isSuperAdmin) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    recordProfileReads(parsed);
    recordSessionRequest(parsed);
  };

  // Attach the client listener synchronously: on a cold start the upstream
  // token fetch below is async, and any frame sent by the client before the
  // upstream socket exists must not be dropped.
  socket.on("message", (data: RawData, isBinary: boolean) => {
    const text = rawToString(data);
    pruneSessionOwners();
    const outcome = guardClientFrame(text, isBinary, userRef, db, sessionOwners);
    if (outcome.action === "reject") {
      const auditAction =
        outcome.code === "PROFILE_FORBIDDEN"
          ? "ws.profile.forbidden"
          : outcome.code === "INVALID_ATTACHMENT_TYPE"
            ? "ws.upload.invalid_type"
            : "ws.frame.invalid";
      logAudit(db, {
        actorId: userRef.id >= 0 ? userRef.id : null,
        action: auditAction,
        targetType: "hermes_ws",
        targetId: null,
        ip: request.ip,
        // REQ-023：仅记录可读 message，绝不写 token / 密钥 / 文件字节 / base64。
        detail: outcome.code === "INVALID_ATTACHMENT_TYPE" ? (outcome.message ?? null) : null,
      });
      sendToClient(
        outcome.code === "PROFILE_FORBIDDEN"
          ? profileForbiddenFrame(outcome.id)
          : outcome.code === "INVALID_ATTACHMENT_TYPE"
            ? invalidAttachmentFrame(outcome.id, outcome.message)
            : invalidFrame(outcome.id),
      );
      return;
    }

    recordClientRequest(outcome.text);

    if (!sendUpstream(outcome.text)) {
      const bytes = Buffer.byteLength(outcome.text);
      if (
        pending.length >= WS_MAX_PENDING_COUNT ||
        pendingBytes + bytes > WS_MAX_PENDING_BYTES
      ) {
        logAudit(db, {
          actorId: userRef.id >= 0 ? userRef.id : null,
          action: "ws.queue.overflow",
          targetType: "hermes_ws",
          targetId: null,
          ip: request.ip,
          detail: null,
        });
        sendToClient(invalidFrame(null));
        socket.close(1013, "QUEUE_OVERFLOW");
        return;
      }
      pending.push({ data: outcome.text, isBinary: false, bytes });
      pendingBytes += bytes;
    }
  });
  socket.on("close", () => {
    upstreamSocket?.close();
  });
  socket.on("error", () => {
    upstreamSocket?.terminate();
  });

  const target = resolveTarget(db, options.defaultBaseUrl, readConnectionId(request));
  const upstream = hermesUpstream({ hermesBaseUrl: options.defaultBaseUrl }, target.baseUrl);
  const token = target.token ?? (await getHermesToken(upstream.baseUrl));
  const ws = new WebSocket(`${upstream.wsBaseUrl}/api/ws?token=${encodeURIComponent(token)}`, {
    maxPayload: WS_MAX_PAYLOAD,
  });
  upstreamSocket = ws;

  const flushOutbound = () => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    for (const frame of outbound.splice(0)) {
      socket.send(frame.data, { binary: frame.isBinary });
    }
    outboundBytes = 0;
  };

  ws.on("open", () => {
    for (const frame of pending.splice(0)) {
      ws.send(frame.data, { binary: frame.isBinary });
    }
    pendingBytes = 0;
  });
  ws.on("message", (data: RawData, isBinary: boolean) => {
    let outgoing: RawData | string = data;
    let outgoingBinary = isBinary;
    if (!isBinary && !isSuperAdmin) {
      pruneProfileReads();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawToString(data));
      } catch {
        parsed = undefined;
      }
      if (Array.isArray(parsed)) {
        let changed = false;
        const next = parsed.map((item) => {
          const outcome = handleUpstreamProfileRead(db, pendingProfileReads, item);
          if (outcome.action === "replace") {
            changed = true;
            return outcome.frame;
          }
          return item;
        });
        if (changed) {
          outgoing = JSON.stringify(next);
          outgoingBinary = false;
        }
      } else if (parsed !== undefined) {
        const outcome = handleUpstreamProfileRead(db, pendingProfileReads, parsed);
        if (outcome.action === "replace") {
          outgoing = JSON.stringify(outcome.frame);
          outgoingBinary = false;
        }
      }
      if (parsed !== undefined) {
        applySessionOwnerResponse(parsed);
      }
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(outgoing, { binary: outgoingBinary });
    } else {
      // Defensive: the client may not be ready yet; replay once it opens.
      const bytes = frameBytes(outgoing);
      if (shouldRejectOutbound(outbound.length, outboundBytes + bytes)) {
        // 对称防御（见 `WS_MAX_OUTBOUND_*` 注释）：上游帧在客户端就绪前无界堆积 → 拒绝。
        logAudit(db, {
          actorId: userRef.id >= 0 ? userRef.id : null,
          action: "ws.outbound.overflow",
          targetType: "hermes_ws",
          targetId: null,
          ip: request.ip,
          detail: null,
        });
        socket.close(1013, "QUEUE_OVERFLOW");
        return;
      }
      outbound.push({ data: outgoing, isBinary: outgoingBinary, bytes });
      outboundBytes += bytes;
    }
  });
  ws.on("close", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "UPSTREAM_CLOSED");
    }
  });
  ws.on("error", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1011, "UPSTREAM_ERROR");
    } else {
      socket.terminate();
    }
  });

  if (socket.readyState === WebSocket.OPEN) {
    flushOutbound();
  } else {
    socket.once("open", flushOutbound);
  }
}

export const hermesWsRoutes: FastifyPluginAsync<HermesWsOptions> = async (app, opts) => {
  app.get("/api/hermes/ws", { websocket: true, preHandler: requireAuth }, (socket, request) => {
    void bridge(socket, request, opts).catch(() => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1011, "HERMES_WS_ERROR");
      }
    });
  });
};

/**
 * 允许经 `/api/hermes/stream` 代理的 Hermes WS 路径（**白名单**，防开放代理/SSRF）。
 * - `/api/events`：会话事件流
 * - `/api/plugins/kanban/events`：看板事件流（M20）
 * - `/api/audio/speak-stream`：语音合成流（M19）
 */
const STREAM_PATHS: ReadonlySet<string> = new Set([
  "/api/events",
  "/api/plugins/kanban/events",
  "/api/audio/speak-stream",
]);

export function isAllowedStreamPath(path: string): boolean {
  return STREAM_PATHS.has(path);
}

/**
 * 事件/音频流代理（M19/M20）：认证后打开上游 WS 并**双向**透传（事件多为服务端推送，
 * `speak-stream` 需客户端上行）。default-deny 同 `/api/hermes/ws`：仅白名单路径；帧上限沿用
 * `WS_MAX_PAYLOAD` 与 `pending`/`outbound` 双上限；二进制帧原样透传。
 */
async function streamBridge(
  socket: WebSocket,
  request: FastifyRequest,
  options: HermesWsOptions,
  path: string,
): Promise<void> {
  const db = options.db;
  const target = resolveTarget(db, options.defaultBaseUrl, readConnectionId(request));
  const upstream = hermesUpstream({ hermesBaseUrl: options.defaultBaseUrl }, target.baseUrl);
  const token = target.token ?? (await getHermesToken(upstream.baseUrl));

  const pending: PendingFrame[] = [];
  const outbound: PendingFrame[] = [];
  let pendingBytes = 0;
  let outboundBytes = 0;

  const ws = new WebSocket(`${upstream.wsBaseUrl}${path}?token=${encodeURIComponent(token)}`, {
    maxPayload: WS_MAX_PAYLOAD,
  });

  const flushToClient = () => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    for (const frame of outbound.splice(0)) {
      socket.send(frame.data, { binary: frame.isBinary });
    }
    outboundBytes = 0;
  };

  ws.on("open", () => {
    for (const frame of pending.splice(0)) {
      ws.send(frame.data, { binary: frame.isBinary });
    }
    pendingBytes = 0;
    flushToClient();
  });

  ws.on("message", (data: RawData, isBinary: boolean) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data, { binary: isBinary });
      return;
    }
    const bytes = frameBytes(data);
    if (shouldRejectOutbound(outbound.length, outboundBytes + bytes)) {
      logAudit(db, {
        actorId: request.user?.id ?? null,
        action: "ws.outbound.overflow",
        targetType: "hermes_stream",
        targetId: path,
        ip: request.ip,
        detail: null,
      });
      socket.close(1013, "QUEUE_OVERFLOW");
      return;
    }
    outbound.push({ data, isBinary, bytes });
    outboundBytes += bytes;
  });

  ws.on("close", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "UPSTREAM_CLOSED");
    }
  });
  ws.on("error", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1011, "UPSTREAM_ERROR");
    } else {
      socket.terminate();
    }
  });

  socket.on("message", (data: RawData, isBinary: boolean) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data, { binary: isBinary });
      return;
    }
    const bytes = frameBytes(data);
    if (pending.length >= WS_MAX_PENDING_COUNT || pendingBytes + bytes > WS_MAX_PENDING_BYTES) {
      socket.close(1013, "QUEUE_OVERFLOW");
      return;
    }
    pending.push({ data, isBinary, bytes });
    pendingBytes += bytes;
  });
  socket.on("close", () => {
    ws.close();
  });
  socket.on("error", () => {
    ws.terminate();
  });

  if (socket.readyState === WebSocket.OPEN) {
    flushToClient();
  } else {
    socket.once("open", flushToClient);
  }
}

export const hermesStreamRoutes: FastifyPluginAsync<HermesWsOptions> = async (app, opts) => {
  app.get("/api/hermes/stream", { websocket: true, preHandler: requireAuth }, (socket, request) => {
    const raw = (request.query as Record<string, unknown> | undefined)?.path;
    const path = typeof raw === "string" ? raw : "";
    if (!isAllowedStreamPath(path)) {
      socket.close(1008, "STREAM_PATH_NOT_ALLOWED");
      return;
    }
    void streamBridge(socket, request, opts, path).catch(() => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1011, "HERMES_STREAM_ERROR");
      }
    });
  });
};
