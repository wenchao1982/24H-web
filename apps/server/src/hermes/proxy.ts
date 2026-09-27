import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import WebSocket, { type RawData } from "ws";
import type { Db } from "../db";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "./client";
import { resolveTarget } from "./connections";

export interface HermesWsOptions {
  db: Db;
  defaultBaseUrl: string;
}

interface PendingFrame {
  data: RawData;
  isBinary: boolean;
}

function readConnectionId(request: FastifyRequest): string | null {
  const query = request.query as Record<string, unknown> | undefined;
  const value = query?.connection;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
  const pending: PendingFrame[] = [];
  const outbound: PendingFrame[] = [];
  let upstreamSocket: WebSocket | null = null;

  // Attach the client listener synchronously: on a cold start the upstream
  // token fetch below is async, and any frame sent by the client before the
  // upstream socket exists must not be dropped.
  socket.on("message", (data: RawData, isBinary: boolean) => {
    if (upstreamSocket && upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.send(data, { binary: isBinary });
    } else if (!upstreamSocket || upstreamSocket.readyState === WebSocket.CONNECTING) {
      pending.push({ data, isBinary });
    }
  });
  socket.on("close", () => {
    upstreamSocket?.close();
  });
  socket.on("error", () => {
    upstreamSocket?.terminate();
  });

  const target = resolveTarget(options.db, options.defaultBaseUrl, readConnectionId(request));
  const upstream = hermesUpstream({ hermesBaseUrl: options.defaultBaseUrl }, target.baseUrl);
  const token = target.token ?? (await getHermesToken(upstream.baseUrl));
  const ws = new WebSocket(
    `${upstream.wsBaseUrl}/api/ws?token=${encodeURIComponent(token)}`,
  );
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
  });
  ws.on("message", (data: RawData, isBinary: boolean) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data, { binary: isBinary });
    } else {
      // Defensive: the client may not be ready yet; replay once it opens.
      outbound.push({ data, isBinary });
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
