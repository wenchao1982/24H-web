import type { FastifyPluginAsync } from "fastify";
import WebSocket, { type RawData } from "ws";
import type { Db } from "../db";
import { requireAuth } from "../session/middleware";
import { getHermesToken, hermesUpstream } from "./client";

export interface HermesWsOptions {
  db: Db;
  defaultBaseUrl: string;
}

interface PendingFrame {
  data: RawData;
  isBinary: boolean;
}

/**
 * Authenticate the upgrade request with the BFF session cookie, then open a
 * server-to-server WebSocket to Hermes and pipe frames both ways.
 */
async function bridge(socket: WebSocket, options: HermesWsOptions): Promise<void> {
  const upstream = hermesUpstream({ hermesBaseUrl: options.defaultBaseUrl });
  const token = await getHermesToken(upstream.baseUrl);
  const target = new WebSocket(`${upstream.wsBaseUrl}/api/ws?token=${encodeURIComponent(token)}`);

  const pending: PendingFrame[] = [];

  socket.on("message", (data: RawData, isBinary: boolean) => {
    if (target.readyState === WebSocket.OPEN) {
      target.send(data, { binary: isBinary });
    } else if (target.readyState === WebSocket.CONNECTING) {
      pending.push({ data, isBinary });
    }
  });
  socket.on("close", () => {
    target.close();
  });
  socket.on("error", () => {
    target.terminate();
  });

  target.on("open", () => {
    for (const frame of pending.splice(0)) {
      target.send(frame.data, { binary: frame.isBinary });
    }
  });
  target.on("message", (data: RawData, isBinary: boolean) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data, { binary: isBinary });
    }
  });
  target.on("close", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "UPSTREAM_CLOSED");
    }
  });
  target.on("error", () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1011, "UPSTREAM_ERROR");
    } else {
      socket.terminate();
    }
  });
}

export const hermesWsRoutes: FastifyPluginAsync<HermesWsOptions> = async (app, opts) => {
  app.get("/api/hermes/ws", { websocket: true, preHandler: requireAuth }, (socket) => {
    void bridge(socket, opts).catch(() => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1011, "HERMES_WS_ERROR");
      }
    });
  });
};
