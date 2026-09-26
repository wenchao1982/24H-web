import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import { startMockHermes, type MockHermes } from "../test/mockHermes";
import { clearHermesTokenCache } from "../hermes/client";
import { createUser } from "../users/repo";

let ctx: TestContext | undefined;
let upstreamA: MockHermes | undefined;
let upstreamB: MockHermes | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
  if (upstreamA) {
    clearHermesTokenCache(upstreamA.baseUrl);
  }
  if (upstreamB) {
    clearHermesTokenCache(upstreamB.baseUrl);
  }
  await upstreamA?.close();
  await upstreamB?.close();
  upstreamA = undefined;
  upstreamB = undefined;
});

describe("admin connections CRUD", () => {
  it("creates, lists, updates and deletes a connection without exposing the token", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const cookies = { "24h_session": session, "24h_csrf": csrf };
    const headers = { "x-csrf-token": csrf };

    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/connections",
      cookies,
      headers,
      payload: {
        label: "local hermes",
        url: "http://127.0.0.1:9119/",
        token: "conn-secret-token",
        isDefault: true,
      },
    });

    expect(created.statusCode).toBe(201);
    const body = created.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      label: "local hermes",
      url: "http://127.0.0.1:9119",
      has_token: true,
      is_default: true,
    });
    expect(body).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toContain("conn-secret-token");

    const list = await ctx.app.inject({ method: "GET", url: "/api/admin/connections", cookies });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(JSON.stringify(list.json())).not.toContain("conn-secret-token");

    const id = body.id as string;
    const patched = await ctx.app.inject({
      method: "PATCH",
      url: `/api/admin/connections/${id}`,
      cookies,
      headers,
      payload: { label: "renamed" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ id, label: "renamed", is_default: true });

    const removed = await ctx.app.inject({
      method: "DELETE",
      url: `/api/admin/connections/${id}`,
      cookies,
      headers,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ ok: true });

    const empty = await ctx.app.inject({ method: "GET", url: "/api/admin/connections", cookies });
    expect(empty.json()).toHaveLength(0);

    const actions = ctx.db
      .prepare("SELECT action FROM audit WHERE target_type = 'connection' ORDER BY id")
      .all() as { action: string }[];
    expect(actions.map((row) => row.action)).toEqual([
      "connection.create",
      "connection.update",
      "connection.delete",
    ]);
  });

  it("rejects an invalid url and unknown ids", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const cookies = { "24h_session": session, "24h_csrf": csrf };
    const headers = { "x-csrf-token": csrf };

    const badUrl = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/connections",
      cookies,
      headers,
      payload: { label: "bad", url: "not-a-url" },
    });
    expect(badUrl.statusCode).toBe(400);
    expect(badUrl.json().error).toBe("INVALID_INPUT");

    const missing = await ctx.app.inject({
      method: "PATCH",
      url: "/api/admin/connections/does-not-exist",
      cookies,
      headers,
      payload: { label: "x" },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("forbids a plain admin with 403", async () => {
    ctx = await createTestContext();
    await createUser(ctx.db, { username: "alice", password: "alice-password-123", role: "admin" });
    const { session } = await loginAndGetCookies(ctx.app, "alice", "alice-password-123");

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/connections",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("connection selection in the proxy", () => {
  it("routes to the selected connection, then to the default connection", async () => {
    upstreamA = await startMockHermes({ token: "token-a" });
    upstreamB = await startMockHermes({ token: "token-b" });
    ctx = await createTestContext({ hermesBaseUrl: upstreamA.baseUrl });
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const cookies = { "24h_session": session, "24h_csrf": csrf };
    const headers = { "x-csrf-token": csrf };

    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/connections",
      cookies,
      headers,
      payload: { label: "b", url: upstreamB.baseUrl, token: "token-b", isDefault: true },
    });
    const connectionId = (created.json() as { id: string }).id;

    const selected = await ctx.app.inject({
      method: "GET",
      url: `/api/hermes/skills?connection=${connectionId}`,
      cookies: { "24h_session": session },
    });
    expect(selected.statusCode).toBe(200);
    const forwarded = upstreamB.requests.find((request) => request.path === "/api/skills");
    expect(forwarded?.headers["x-hermes-session-token"]).toBe("token-b");
    expect(upstreamA.requests).toHaveLength(0);

    const viaDefault = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/status",
      cookies: { "24h_session": session },
    });
    expect(viaDefault.statusCode).toBe(200);
    expect(upstreamB.requests.some((request) => request.path === "/api/status")).toBe(true);

    const removed = await ctx.app.inject({
      method: "DELETE",
      url: `/api/admin/connections/${connectionId}`,
      cookies,
      headers,
    });
    expect(removed.statusCode).toBe(200);

    const afterDelete = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/status",
      cookies: { "24h_session": session },
    });
    expect(afterDelete.statusCode).toBe(200);
    expect(upstreamA.requests.some((request) => request.path === "/api/status")).toBe(true);
  });

  it("returns 404 for an unknown connection id", async () => {
    upstreamA = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstreamA.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/hermes/skills?connection=missing",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("CONNECTION_NOT_FOUND");
  });
});
