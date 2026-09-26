import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  loginAndGetCookies,
  TEST_ADMIN_PASSWORD,
  type TestContext,
} from "../test/helpers";
import { createUser } from "../users/repo";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("PATCH /api/auth/profile", () => {
  it("renames the current user", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/auth/profile",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { username: "renamed-admin" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, username: "renamed-admin" });

    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { "24h_session": session },
    });
    expect(me.json().username).toBe("renamed-admin");

    const relogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "renamed-admin", password: TEST_ADMIN_PASSWORD },
    });
    expect(relogin.statusCode).toBe(200);
  });

  it("rejects a username that is already taken with 409", async () => {
    ctx = await createTestContext();
    await createUser(ctx.db, { username: "taken", password: "taken-password-123", role: "admin" });
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/auth/profile",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { username: "taken" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("USERNAME_TAKEN");
  });

  it("rejects an unauthenticated request with 401", async () => {
    ctx = await createTestContext();
    const { csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/auth/profile",
      cookies: { "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { username: "whatever" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects an empty username with 400", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/auth/profile",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { username: "  " },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("INVALID_INPUT");
  });
});
