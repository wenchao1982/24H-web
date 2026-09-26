import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { ApiError } from "./errors";

export const CSRF_COOKIE = "24h_csrf";
export const CSRF_HEADER = "x-csrf-token";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_PATHS = new Set(["/api/auth/login"]);

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export function issueCsrfToken(reply: FastifyReply, opts: { secure: boolean }): string {
  const token = randomBytes(32).toString("hex");
  reply.setCookie(CSRF_COOKIE, token, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: opts.secure,
  });
  return token;
}

export function registerCsrfGuard(app: FastifyInstance): void {
  app.addHook("preHandler", async (request) => {
    if (!UNSAFE_METHODS.has(request.method)) {
      return;
    }

    const path = request.url.split("?")[0];
    if (!path.startsWith("/api/") || EXEMPT_PATHS.has(path)) {
      return;
    }

    const cookie = request.cookies[CSRF_COOKIE];
    const header = request.headers[CSRF_HEADER];
    if (!cookie || typeof header !== "string" || !safeEqual(cookie, header)) {
      throw new ApiError(403, "CSRF_REQUIRED", "缺少或无效的 CSRF 令牌");
    }
  });
}
