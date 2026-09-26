import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  type TestContext,
} from "../test/helpers";

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
  expect(res.statusCode).toBe(200);
  return String(res.headers["set-cookie"]).split(";")[0].split("=")[1];
}

describe("POST /api/auth/logout", () => {
  it("deletes the session so the old cookie no longer authenticates", async () => {
    ctx = await createTestContext();
    const token = await loginToken(ctx);

    const logout = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { "24h_session": token },
    });

    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });
    expect(String(logout.headers["set-cookie"])).toContain("24h_session=;");

    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { "24h_session": token },
    });
    expect(me.statusCode).toBe(401);
  });

  it("is idempotent without a session", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "POST", url: "/api/auth/logout" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
