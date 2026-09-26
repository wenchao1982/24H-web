import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import { createUser } from "../users/repo";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("GET /api/admin/users", () => {
  it("lists users with their profiles and never exposes password hashes", async () => {
    ctx = await createTestContext();
    const alice = await createUser(ctx.db, {
      username: "alice",
      password: "alice-password-123",
      role: "admin",
    });
    const insertProfile = ctx.db.prepare(
      "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, ?, ?)",
    );
    insertProfile.run(alice.id, "alpha", 1, Date.now());
    insertProfile.run(alice.id, "beta", 0, Date.now());

    const { session } = await loginAndGetCookies(ctx.app);
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    const users = res.json() as Record<string, unknown>[];
    expect(users).toHaveLength(2);

    const found = users.find((user) => user.username === "alice");
    expect(found).toMatchObject({
      username: "alice",
      role: "admin",
      status: "active",
      profiles: ["alpha", "beta"],
      default_profile: "alpha",
      must_change_password: 0,
    });
    expect(found).not.toHaveProperty("password_hash");

    const admin = users.find((user) => user.username === "admin");
    expect(admin).toMatchObject({ role: "super_admin", profiles: [] });
  });

  it("forbids a plain admin with 403", async () => {
    ctx = await createTestContext();
    await createUser(ctx.db, {
      username: "alice",
      password: "alice-password-123",
      role: "admin",
    });
    const { session } = await loginAndGetCookies(ctx.app, "alice", "alice-password-123");

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
  });

  it("returns 401 when unauthenticated", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "GET", url: "/api/admin/users" });

    expect(res.statusCode).toBe(401);
  });
});
