import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  loginAndGetCookies,
  type TestContext,
} from "../test/helpers";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("POST /api/auth/logout", () => {
  it("deletes the session so the old cookie no longer authenticates", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const logout = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
    });

    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });
    expect(String(logout.headers["set-cookie"])).toContain("24h_session=;");

    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { "24h_session": session },
    });
    expect(me.statusCode).toBe(401);
  });

  it("is idempotent without a session", async () => {
    ctx = await createTestContext();
    const { csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("rejects a request without a CSRF token", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "POST", url: "/api/auth/logout" });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("CSRF_REQUIRED");
  });
});
