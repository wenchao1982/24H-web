import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "../db";

export interface BuildAppOptions {
  logger?: boolean;
}

export function buildApp(db: Db, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });

  app.decorate("db", db);

  app.get("/health", async () => ({ ok: true }));

  return app;
}
