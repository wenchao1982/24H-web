import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import { startMockHermes, type MockHermes } from "../test/mockHermes";
import { clearHermesTokenCache, getHermesToken } from "../hermes/client";
import { createUser } from "../users/repo";

let ctx: TestContext | undefined;
let upstream: MockHermes | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
  if (upstream) {
    clearHermesTokenCache(upstream.baseUrl);
  }
  await upstream?.close();
  upstream = undefined;
});

describe("ALL /api/hermes/*", () => {
  it("forwards method, path and query, and injects the session token", async () => {
    upstream = await startMockHermes({ token: "up-token-1" });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills?category=core",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      method: "GET",
      path: "/api/skills",
      url: "/api/skills?category=core",
      body: null,
      token: "up-token-1",
    });

    const forwarded = upstream.requests.find((request) => request.path === "/api/skills");
    expect(forwarded?.headers["x-hermes-session-token"]).toBe("up-token-1");
  });

  it("forwards a JSON body for unsafe methods", async () => {
    upstream = await startMockHermes({ token: "up-token-2" });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/hermes/sessions",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { title: "hello", nested: { n: 2 } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      method: "POST",
      path: "/api/sessions",
      body: { title: "hello", nested: { n: 2 } },
      token: "up-token-2",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });

    const res = await ctx.app.inject({ method: "GET", url: "/api/hermes/status" });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("UNAUTHENTICATED");
    expect(upstream.requests).toHaveLength(0);
  });

  it("does not expose the Hermes token in the response", async () => {
    upstream = await startMockHermes({ token: "super-secret-token" });
    upstream.setHandler(({ res, request }) => {
      if (request.path === "/api/config") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, model: "gpt" }));
        return true;
      }
      return false;
    });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/config",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("super-secret-token");
    expect(JSON.stringify(res.headers)).not.toContain("super-secret-token");
  });
});

describe("profile guard", () => {
  async function seedAdmin(profiles: string[]): Promise<{ session: string; csrf: string }> {
    const alice = await createUser(ctx!.db, {
      username: "alice",
      password: "alice-password-123",
      role: "admin",
    });
    const insert = ctx!.db.prepare(
      "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, 0, ?)",
    );
    for (const profile of profiles) {
      insert.run(alice.id, profile, Date.now());
    }
    return loginAndGetCookies(ctx!.app, "alice", "alice-password-123");
  }

  it("forbids an admin from a profile they do not own (query)", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await seedAdmin(["alpha"]);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills?profile=beta",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("PROFILE_FORBIDDEN");
    expect(upstream.requests).toHaveLength(0);
  });

  it("allows an admin to access a profile they own and does not require a profile", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await seedAdmin(["alpha"]);

    const scoped = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills?profile=alpha",
      cookies: { "24h_session": session },
    });
    expect(scoped.statusCode).toBe(200);

    const unscoped = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/status",
      cookies: { "24h_session": session },
    });
    expect(unscoped.statusCode).toBe(200);
  });

  it("checks the JSON body profile for unsafe methods", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session, csrf } = await seedAdmin(["alpha"]);

    const forbidden = await ctx.app.inject({
      method: "POST",
      url: "/api/hermes/sessions",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { profile: "beta" },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error).toBe("PROFILE_FORBIDDEN");
  });

  it("lets a super_admin access any profile", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills?profile=anything",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
  });

  it("injects the default profile into the forwarded query when missing", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await seedAdmin(["alpha"]);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    // 注入必须落入**被转发的 query**（仅改 request.query 会静默失效）。
    const forwarded = upstream.requests.find((request) => request.path === "/api/skills");
    expect(forwarded?.query).toContain("profile=alpha");
    expect(res.json().url).toContain("profile=alpha");
  });

  it("forbids an admin with no assigned profile", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await seedAdmin([]);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("PROFILE_FORBIDDEN");
    expect(upstream.requests).toHaveLength(0);
  });

  it("lets an admin reach the exempt health path without a profile", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await seedAdmin(["alpha"]);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/health",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("does not inject or block for a super_admin", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    const forwarded = upstream.requests.find((request) => request.path === "/api/skills");
    expect(forwarded?.query ?? "").not.toContain("profile=");
    expect(res.json().url).not.toContain("profile=");
  });

  it("writes an audit entry when a profile access is forbidden", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await seedAdmin(["alpha"]);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills?profile=beta",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(403);
    const row = ctx.db
      .prepare("SELECT COUNT(*) AS n FROM audit WHERE action = ?")
      .get("rest.profile.forbidden") as { n: number };
    expect(row.n).toBeGreaterThanOrEqual(1);
  });
});

describe("proxy error normalisation", () => {
  it("returns 502 HERMES_UNREACHABLE when the upstream is down", async () => {
    upstream = await startMockHermes({ token: "down-token" });
    const baseUrl = upstream.baseUrl;
    ctx = await createTestContext({ hermesBaseUrl: baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    await getHermesToken(baseUrl);
    await upstream.close();
    upstream = undefined;

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/status",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      error: "HERMES_UNREACHABLE",
      message: expect.any(String),
    });
    expect(res.body).not.toContain("down-token");
  });

  it("wraps a non-JSON upstream response while preserving the status", async () => {
    upstream = await startMockHermes();
    upstream.setHandler(({ res, request }) => {
      if (request.path === "/api/raw") {
        res.statusCode = 418;
        res.setHeader("content-type", "text/plain");
        res.end("boom");
        return true;
      }
      return false;
    });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/raw",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(418);
    expect(res.json()).toEqual({ error: "UPSTREAM_ERROR", message: "boom" });
  });

  it("wraps malformed JSON upstream responses", async () => {
    upstream = await startMockHermes();
    upstream.setHandler(({ res, request }) => {
      if (request.path === "/api/broken") {
        res.setHeader("content-type", "application/json");
        res.end("{not-json");
        return true;
      }
      return false;
    });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/broken",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ error: "UPSTREAM_ERROR", message: "{not-json" });
  });
});

describe("GET /api/hermes/health", () => {
  it("reports ok with the upstream version when healthy", async () => {
    upstream = await startMockHermes({ version: "1.2.3" });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/health",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, version: "1.2.3", baseUrl: upstream.baseUrl });
  });

  it("reports ok:false with a 200 when the upstream is down", async () => {
    upstream = await startMockHermes();
    const baseUrl = upstream.baseUrl;
    ctx = await createTestContext({ hermesBaseUrl: baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);
    await upstream.close();
    upstream = undefined;

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/health",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: false, baseUrl });
  });

  it("requires authentication", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });

    const res = await ctx.app.inject({ method: "GET", url: "/api/hermes/health" });
    expect(res.statusCode).toBe(401);
  });
});
