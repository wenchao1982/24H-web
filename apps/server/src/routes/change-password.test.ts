import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  loginAndGetCookies,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  type TestContext,
} from "../test/helpers";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("POST /api/auth/change-password", () => {
  it("rejects a wrong old password with 400 and keeps the flag", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { oldPassword: "nope", newPassword: "brand-new-password" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("INVALID_OLD_PASSWORD");
  });

  it("changes the password and clears must_change_password", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { oldPassword: TEST_ADMIN_PASSWORD, newPassword: "brand-new-password" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { "24h_session": session },
    });
    expect(me.json().must_change_password).toBe(0);

    const relogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: TEST_ADMIN_USERNAME, password: "brand-new-password" },
    });
    expect(relogin.statusCode).toBe(200);
  });

  it("rejects an unauthenticated request with 401", async () => {
    ctx = await createTestContext();
    const { csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { oldPassword: TEST_ADMIN_PASSWORD, newPassword: "brand-new-password" },
    });

    expect(res.statusCode).toBe(401);
  });
});
