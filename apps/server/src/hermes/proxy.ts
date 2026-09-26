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
  const target = resolveTarget(options.db, options.defaultBaseUrl, readConnectionId(request));
  const upstream = hermesUpstream({ hermesBaseUrl: options.defaultBaseUrl }, target.baseUrl);
  const token = target.token ?? (await getHermesToken(upstream.baseUrl));
  const upstreamSocket = new WebSocket(
    `${upstream.wsBaseUrl}/api/ws?token=${encodeURIComponent(token)}`,
  );

  const pending: PendingFrame[] = [];

  socket.on("message", (data: RawData, isBinary: boolean) => {
    if (upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.send(data, { binary: isBinary });
    } else if (upstreamSocket.readyState === WebSocket.CONNECTING) {
      pending.push({ data, isBinary });
    }
  });
  socket.on("close", () => {
    upstreamSocket.close();
  });
  socket.on("error", () => {
    upstreamSocket.terminate();
  });

  upstreamSocket.on("open", () => {
    for (const frame of pending.splice(0)) {
      upstreamSocket.send(frame.data, { binary: frame.isBinary });
    }
  });
  upstreamSocket.on("message", (data: RawData, isBinary: boolean) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data, { binary: isBinary });
    }
  });
  upstreamSocket.on("close", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "UPSTREAM_CLOSED");
    }
  });
  upstreamSocket.on("error", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1011, "UPSTREAM_ERROR");
    } else {
      socket.terminate();
    }
  });
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
