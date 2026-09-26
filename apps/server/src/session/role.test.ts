import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  type TestContext,
} from "../test/helpers";
import { createUser } from "../users/repo";
import { requireSuperAdmin } from "./middleware";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

async function tokenFor(context: TestContext, username: string, password: string): Promise<string> {
  const res = await context.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password },
  });
  expect(res.statusCode).toBe(200);
  return String(res.headers["set-cookie"]).split(";")[0].split("=")[1];
}

describe("requireSuperAdmin", () => {
  it("allows a super_admin", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_admin", { preHandler: requireSuperAdmin }, async () => ({ ok: true }));
    const token = await tokenFor(ctx, TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/_admin",
      cookies: { "24h_session": token },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("forbids a plain admin with 403", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_admin", { preHandler: requireSuperAdmin }, async () => ({ ok: true }));
    await createUser(ctx.db, { username: "alice", password: "alice-password-123", role: "admin" });
    const token = await tokenFor(ctx, "alice", "alice-password-123");

    const res = await ctx.app.inject({
      method: "GET",
      url: "/_admin",
      cookies: { "24h_session": token },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
  });

  it("returns 401 when unauthenticated", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_admin", { preHandler: requireSuperAdmin }, async () => ({ ok: true }));

    const res = await ctx.app.inject({ method: "GET", url: "/_admin" });

    expect(res.statusCode).toBe(401);
  });
});
