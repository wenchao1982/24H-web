import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import { startMockHermes, type MockHermes } from "../test/mockHermes";
import { clearHermesTokenCache } from "../hermes/client";
import { WEB_VERSION } from "./system";

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

describe("GET /api/system/version", () => {
  it("returns the core version from Hermes and the web build version", async () => {
    upstream = await startMockHermes({ version: "1.4.2" });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/system/version",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      core: "1.4.2",
      web: WEB_VERSION,
      baseUrl: upstream.baseUrl,
    });
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
      url: "/api/system/version",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: false, core: null, web: WEB_VERSION, baseUrl });
  });

  it("requires authentication", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const res = await ctx.app.inject({ method: "GET", url: "/api/system/version" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/system/update", () => {
  it("returns an unsupported result (real upgrade is operator-level)", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/system/update",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { action: "apply" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "unsupported", action: "apply" });
  });

  it("returns queued when explicitly queued", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/system/update",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { action: "queue" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "queued", action: "queue" });
  });

  it("rejects an unauthenticated request (CSRF guard first)", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/system/update",
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });
});
