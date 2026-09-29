import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import WebSocket, { type RawData } from "ws";
import type { Db } from "../db";
import { logAudit } from "../audit/repo";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "./client";
import { resolveTarget } from "./connections";
import { listUserProfiles } from "../users/repo";
import {
  classifyFrame,
  guardClientFrame,
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

/** REQ-018 / REQ-018b：`maxPayload` 与队列上限（条数 AND 累计字节）。 */
export const WS_MAX_PAYLOAD = 16 * 1024 * 1024; // 16 MiB
export const WS_QUEUE_FACTOR = 4;
export const WS_MAX_PENDING_BYTES = WS_QUEUE_FACTOR * WS_MAX_PAYLOAD; // 64 MiB

/** 响应过滤待决表上限（REQ-015 兜底：伪造 id / 并发洪泛）。 */
const MAX_PENDING_PROFILE_READS = 256;
const PENDING_PROFILE_READ_TTL_MS = 60_000;

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
  const pendingProfileReads = new Map<string, PendingProfileRead>();
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

  const recordProfileReads = (text: string) => {
    if (isSuperAdmin) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
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

  // Attach the client listener synchronously: on a cold start the upstream
  // token fetch below is async, and any frame sent by the client before the
  // upstream socket exists must not be dropped.
  socket.on("message", (data: RawData, isBinary: boolean) => {
    const text = rawToString(data);
    const outcome = guardClientFrame(text, isBinary, userRef, db);
    if (outcome.action === "reject") {
      logAudit(db, {
        actorId: userRef.id >= 0 ? userRef.id : null,
        action: outcome.code === "PROFILE_FORBIDDEN" ? "ws.profile.forbidden" : "ws.frame.invalid",
        targetType: "hermes_ws",
        targetId: null,
        ip: request.ip,
        detail: null,
      });
      sendToClient(
        outcome.code === "PROFILE_FORBIDDEN"
          ? profileForbiddenFrame(outcome.id)
          : invalidFrame(outcome.id),
      );
      return;
    }

    recordProfileReads(outcome.text);

    if (!sendUpstream(outcome.text)) {
      const bytes = Buffer.byteLength(outcome.text);
      if (pending.length >= WS_QUEUE_FACTOR || pendingBytes + bytes > WS_MAX_PENDING_BYTES) {
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
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(outgoing, { binary: outgoingBinary });
    } else {
      // Defensive: the client may not be ready yet; replay once it opens.
      outbound.push({ data: outgoing, isBinary: outgoingBinary, bytes: frameBytes(outgoing) });
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

  // classifyFrame 在响应过滤路径复用（避免两处独立解析）。
  void classifyFrame;
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
