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

describe("PATCH /api/admin/users/:id", () => {
  async function seedAlice(): Promise<{ id: number; session: string; csrf: string }> {
    const alice = await createUser(ctx!.db, {
      username: "alice",
      password: "alice-password-123",
      role: "admin",
    });
    const { session, csrf } = await loginAndGetCookies(ctx!.app);
    return { id: alice.id, session, csrf };
  }

  it("updates role and status and records an audit row", async () => {
    ctx = await createTestContext();
    const { id, session, csrf } = await seedAlice();

    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/admin/users/${id}`,
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { role: "super_admin", status: "disabled" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ role: "super_admin", status: "disabled" });

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "alice-password-123" },
    });
    expect(login.statusCode).toBe(401);

    const audit = ctx.db
      .prepare("SELECT action, target_id FROM audit WHERE action = ?")
      .get("user.update") as Record<string, unknown>;
    expect(audit.target_id).toBe(String(id));
  });

  it("refuses to demote or disable the last active super_admin with 409", async () => {
    ctx = await createTestContext();
    const admin = ctx.db.prepare("SELECT id FROM users WHERE username = ?").get("admin") as {
      id: number;
    };
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const patch = (payload: Record<string, unknown>) =>
      ctx!.app.inject({
        method: "PATCH",
        url: `/api/admin/users/${admin.id}`,
        cookies: { "24h_session": session, "24h_csrf": csrf },
        headers: { "x-csrf-token": csrf },
        payload,
      });

    const demote = await patch({ role: "admin" });
    expect(demote.statusCode).toBe(409);
    expect(demote.json().error).toBe("LAST_SUPER_ADMIN");

    const disable = await patch({ status: "disabled" });
    expect(disable.statusCode).toBe(409);
    expect(disable.json().error).toBe("LAST_SUPER_ADMIN");
  });

  it("allows demoting when another active super_admin exists", async () => {
    ctx = await createTestContext();
    await createUser(ctx.db, {
      username: "root2",
      password: "root2-password-123",
      role: "super_admin",
    });
    const admin = ctx.db.prepare("SELECT id FROM users WHERE username = ?").get("admin") as {
      id: number;
    };
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/admin/users/${admin.id}`,
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { role: "admin" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("admin");
  });

  it("returns 404 for an unknown user and 400 when no fields are provided", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const missing = await ctx.app.inject({
      method: "PATCH",
      url: "/api/admin/users/999999",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { role: "admin" },
    });
    expect(missing.statusCode).toBe(404);

    const empty = await ctx.app.inject({
      method: "PATCH",
      url: "/api/admin/users/1",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("deletes a user, cascades sessions and profiles, and records an audit row", async () => {
    ctx = await createTestContext();
    const alice = await createUser(ctx.db, {
      username: "alice",
      password: "alice-password-123",
      role: "admin",
    });
    ctx.db
      .prepare(
        "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(alice.id, "alpha", 1, Date.now());
    await loginAndGetCookies(ctx.app, "alice", "alice-password-123");

    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const res = await ctx.app.inject({
      method: "DELETE",
      url: `/api/admin/users/${alice.id}`,
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    expect(ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = ?").get(alice.id)).toEqual({ n: 0 });
    expect(
      ctx.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(alice.id),
    ).toEqual({ n: 0 });
    expect(
      ctx.db.prepare("SELECT COUNT(*) AS n FROM user_profiles WHERE user_id = ?").get(alice.id),
    ).toEqual({ n: 0 });

    const audit = ctx.db
      .prepare("SELECT action, target_id FROM audit WHERE action = ?")
      .get("user.delete") as Record<string, unknown>;
    expect(audit.target_id).toBe(String(alice.id));
  });

  it("refuses deleting yourself with 400 CANNOT_DELETE_SELF", async () => {
    ctx = await createTestContext();
    await createUser(ctx.db, {
      username: "root2",
      password: "root2-password-123",
      role: "super_admin",
    });
    const admin = ctx.db.prepare("SELECT id FROM users WHERE username = ?").get("admin") as {
      id: number;
    };
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "DELETE",
      url: `/api/admin/users/${admin.id}`,
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("CANNOT_DELETE_SELF");
  });

  it("refuses deleting the last active super_admin with 409", async () => {
    ctx = await createTestContext();
    const admin = ctx.db.prepare("SELECT id FROM users WHERE username = ?").get("admin") as {
      id: number;
    };
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "DELETE",
      url: `/api/admin/users/${admin.id}`,
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("LAST_SUPER_ADMIN");
  });

  it("returns 404 for an unknown user", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "DELETE",
      url: "/api/admin/users/999999",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PUT /api/admin/users/:id/profiles", () => {
  async function seedAlice(): Promise<{ id: number; session: string; csrf: string }> {
    const alice = await createUser(ctx!.db, {
      username: "alice",
      password: "alice-password-123",
      role: "admin",
    });
    const { session, csrf } = await loginAndGetCookies(ctx!.app);
    return { id: alice.id, session, csrf };
  }

  it("replaces the profile assignment and marks the default", async () => {
    ctx = await createTestContext();
    const { id, session, csrf } = await seedAlice();
    const put = (payload: Record<string, unknown>) =>
      ctx!.app.inject({
        method: "PUT",
        url: `/api/admin/users/${id}/profiles`,
        cookies: { "24h_session": session, "24h_csrf": csrf },
        headers: { "x-csrf-token": csrf },
        payload,
      });

    const first = await put({ profiles: ["alpha", "beta"], defaultProfile: "beta" });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      profiles: ["alpha", "beta"],
      default_profile: "beta",
    });

    const second = await put({ profiles: ["gamma"], defaultProfile: "gamma" });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ profiles: ["gamma"], default_profile: "gamma" });

    const rows = ctx.db
      .prepare("SELECT profile_name, is_default FROM user_profiles WHERE user_id = ? ORDER BY profile_name")
      .all(id) as { profile_name: string; is_default: number }[];
    expect(rows).toEqual([{ profile_name: "gamma", is_default: 1 }]);

    const audit = ctx.db
      .prepare("SELECT action FROM audit WHERE action = ?")
      .get("user.profiles.set") as Record<string, unknown>;
    expect(audit.action).toBe("user.profiles.set");
  });

  it("allows clearing profiles with an empty array", async () => {
    ctx = await createTestContext();
    const { id, session, csrf } = await seedAlice();
    ctx.db
      .prepare(
        "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, "alpha", 1, Date.now());

    const res = await ctx.app.inject({
      method: "PUT",
      url: `/api/admin/users/${id}/profiles`,
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { profiles: [] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ profiles: [], default_profile: null });
  });

  it("rejects a defaultProfile that is not in profiles with 400", async () => {
    ctx = await createTestContext();
    const { id, session, csrf } = await seedAlice();

    const res = await ctx.app.inject({
      method: "PUT",
      url: `/api/admin/users/${id}/profiles`,
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { profiles: ["alpha"], defaultProfile: "beta" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("INVALID_INPUT");
  });
});

