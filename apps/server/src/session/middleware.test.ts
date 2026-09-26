import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  type TestContext,
} from "../test/helpers";
import { requireAuth } from "./middleware";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

async function loginToken(context: TestContext): Promise<string> {
  const res = await context.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
  });
  return String(res.headers["set-cookie"]).split(";")[0].split("=")[1];
}

describe("session middleware", () => {
  it("blocks a protected route without a cookie (401)", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_protected", { preHandler: requireAuth }, async () => ({ ok: true }));

    const res = await ctx.app.inject({ method: "GET", url: "/_protected" });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("UNAUTHENTICATED");
  });

  it("allows a protected route with a valid session and attaches the user", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_whoami", { preHandler: requireAuth }, async (request) => ({
      username: request.user?.username ?? null,
    }));

    const token = await loginToken(ctx);
    const res = await ctx.app.inject({
      method: "GET",
      url: "/_whoami",
      cookies: { "24h_session": token },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ username: TEST_ADMIN_USERNAME });
  });

  it("treats an expired session as unauthenticated", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_protected", { preHandler: requireAuth }, async () => ({ ok: true }));
    const token = await loginToken(ctx);
    ctx.db
      .prepare("UPDATE sessions SET expires_at = ?")
      .run(Date.now() - 1000);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/_protected",
      cookies: { "24h_session": token },
    });

    expect(res.statusCode).toBe(401);
  });
});
