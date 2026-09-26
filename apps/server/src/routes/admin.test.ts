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

describe("POST /api/admin/users", () => {
  it("creates a user, forces a password change, and records an audit row", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/users",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { username: "alice", password: "alice-password-123", role: "admin" },
    });

    expect(res.statusCode).toBe(201);
    const created = res.json() as Record<string, unknown>;
    expect(created).toMatchObject({
      username: "alice",
      role: "admin",
      status: "active",
      profiles: [],
      default_profile: null,
      must_change_password: 1,
    });
    expect(created).not.toHaveProperty("password_hash");

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "alice-password-123" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.must_change_password).toBe(1);

    const audit = ctx.db
      .prepare("SELECT actor_id, action, target_type, target_id FROM audit WHERE action = ?")
      .get("user.create") as Record<string, unknown>;
    expect(audit).toMatchObject({
      action: "user.create",
      target_type: "user",
      target_id: String(created.id),
    });
    expect(audit.actor_id).toEqual(expect.any(Number));
  });

  it("rejects a duplicate username with 409", async () => {
    ctx = await createTestContext();
    await createUser(ctx.db, {
      username: "alice",
      password: "alice-password-123",
      role: "admin",
    });
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/users",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { username: "alice", password: "alice-password-123", role: "admin" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("USERNAME_TAKEN");
  });

  it("rejects an invalid role, a weak password and a bad username", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const post = (payload: Record<string, unknown>) =>
      ctx!.app.inject({
        method: "POST",
        url: "/api/admin/users",
        cookies: { "24h_session": session, "24h_csrf": csrf },
        headers: { "x-csrf-token": csrf },
        payload,
      });

    expect((await post({ username: "bob", password: "bob-password-123", role: "root" })).statusCode).toBe(400);
    expect((await post({ username: "bob", password: "short", role: "admin" })).json().error).toBe("WEAK_PASSWORD");
    expect((await post({ username: "!!", password: "bob-password-123", role: "admin" })).json().error).toBe("INVALID_USERNAME");
  });

  it("forbids a plain admin with 403", async () => {
    ctx = await createTestContext();
    await createUser(ctx.db, { username: "alice", password: "alice-password-123", role: "admin" });
    const { session, csrf } = await loginAndGetCookies(ctx.app, "alice", "alice-password-123");

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/users",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { username: "bob", password: "bob-password-123", role: "admin" },
    });

    expect(res.statusCode).toBe(403);
  });
});

