import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "../db";
import { registerErrorHandler } from "./errors";
import { authRoutes } from "../routes/auth";
import { registerSessionMiddleware } from "../session/middleware";

export interface BuildAppOptions {
  logger?: boolean;
}

export function buildApp(db: Db, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      return typeof header === "string" && header.length > 0 ? header : randomUUID();
    },
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.register(cookie);

  app.decorate("db", db);
  registerErrorHandler(app);
  registerSessionMiddleware(app, db);

  app.register(authRoutes, { db });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
