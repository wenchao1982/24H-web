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

describe("GET /api/auth/me", () => {
  it("returns the current user with their profiles", async () => {
    ctx = await createTestContext();
    const userId = ctx.db.prepare("SELECT id FROM users WHERE username = ?").get(
      TEST_ADMIN_USERNAME,
    ) as { id: number };
    ctx.db
      .prepare(
        "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(userId.id, "alpha", 1, Date.now());
    ctx.db
      .prepare(
        "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(userId.id, "beta", 0, Date.now());

    const token = await loginToken(ctx);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { "24h_session": token },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: userId.id,
      username: TEST_ADMIN_USERNAME,
      role: "super_admin",
      profiles: ["alpha", "beta"],
      default_profile: "alpha",
      must_change_password: 1,
    });
  });

  it("returns 401 without a session cookie", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "GET", url: "/api/auth/me" });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for an unknown session token", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { "24h_session": "not-a-real-token" },
    });

    expect(res.statusCode).toBe(401);
  });
});
