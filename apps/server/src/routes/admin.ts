import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db";
import { listUsers } from "../users/repo";
import { requireSuperAdmin } from "../session/middleware";

export interface AdminRoutesOptions {
  db: Db;
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, opts) => {
  const { db } = opts;

  app.get("/api/admin/users", { preHandler: requireSuperAdmin }, async () => listUsers(db));
};
