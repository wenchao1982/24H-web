import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Db } from "../db";
import type { UserRow } from "../users/repo";
import { ApiError } from "../http/errors";
import { SESSION_COOKIE } from "./repo";
import { resolveSessionUser } from "./auth";

declare module "fastify" {
  interface FastifyRequest {
    user: UserRow | null;
  }
}

export function registerSessionMiddleware(app: FastifyInstance, db: Db): void {
  app.decorateRequest("user", null);
  app.addHook("preHandler", async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    request.user = token ? resolveSessionUser(db, token) : null;
  });
}

export async function requireAuth(request: FastifyRequest): Promise<void> {
  if (!request.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "未登录");
  }
}
