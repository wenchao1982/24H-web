import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, parseCookies, type TestContext } from "../test/helpers";
import { startMockOidc, type MockOidc } from "../test/mockOidc";
import { clearOidcCaches } from "../auth/oidc";

let ctx: TestContext | undefined;
let oidc: MockOidc | undefined;

const OIDC_ENV = ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI"];

beforeEach(() => {
  clearOidcCaches();
});

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
  await oidc?.close();
  oidc = undefined;
  for (const key of OIDC_ENV) {
    delete process.env[key];
  }
  clearOidcCaches();
});

function enableOidc(config: MockOidc): void {
  process.env.OIDC_ISSUER = config.issuer;
  process.env.OIDC_CLIENT_ID = config.clientId;
  process.env.OIDC_CLIENT_SECRET = config.clientSecret;
  process.env.OIDC_REDIRECT_URI = config.redirectUri;
}

interface OidcFlowCookie {
  state: string;
  verifier: string;
  nonce: string;
}

function decodeFlow(cookie: string): OidcFlowCookie {
  return JSON.parse(Buffer.from(cookie, "base64url").toString("utf8")) as OidcFlowCookie;
}

interface ProviderInfo {
  id: string;
  kind: string;
  displayName: string;
}

describe("OIDC provider", () => {
  it("is listed only when OIDC is configured", async () => {
    ctx = await createTestContext();

    const before = await ctx.app.inject({ method: "GET", url: "/api/auth/providers" });
    expect((before.json().providers as ProviderInfo[]).map((p) => p.id)).toEqual(["password"]);

    oidc = await startMockOidc();
    enableOidc(oidc);

    const after = await ctx.app.inject({ method: "GET", url: "/api/auth/providers" });
    const providers = after.json().providers as ProviderInfo[];
    expect(providers.map((p) => p.id)).toEqual(["password", "oidc"]);
    expect(providers[1]).toEqual({
      id: "oidc",
      kind: "redirect",
      displayName: "企业 OIDC 登录",
    });
  });

  it("returns 404 for start when disabled", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "GET", url: "/api/auth/oidc/start" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("OIDC_DISABLED");
  });

  it("JIT-provisions a local admin user and sets a session", async () => {
    oidc = await startMockOidc();
    enableOidc(oidc);
    ctx = await createTestContext();

    const start = await ctx.app.inject({ method: "GET", url: "/api/auth/oidc/start" });
    expect(start.statusCode).toBe(302);

    const location = new URL(String(start.headers.location));
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toBeTruthy();

    const startCookies = parseCookies(start.headers["set-cookie"]);
    const flow = decodeFlow(startCookies["24h_oidc"]);
    const state = location.searchParams.get("state");
    expect(state).toBe(flow.state);

    oidc.setClaims({
      sub: "ext-1",
      nonce: flow.nonce,
      preferred_username: "alice",
      email: "alice@example.com",
    });

    const callback = await ctx.app.inject({
      method: "GET",
      url: `/api/auth/oidc/callback?code=auth-code&state=${state}`,
      cookies: { "24h_oidc": startCookies["24h_oidc"] },
    });

    expect(callback.statusCode).toBe(302);
    expect(String(callback.headers.location)).toBe("/");
    const sessionCookies = parseCookies(callback.headers["set-cookie"]);
    expect(sessionCookies["24h_session"]).toBeTruthy();

    const row = ctx.db
      .prepare("SELECT username, role, status, auth_provider, external_id FROM users WHERE external_id = ?")
      .get("ext-1") as {
      username: string;
      role: string;
      status: string;
      auth_provider: string;
      external_id: string;
    };
    expect(row).toBeTruthy();
    expect(row.username).toBe("alice");
    expect(row.auth_provider).toBe("oidc");
    expect(row.role).toBe("admin");
    expect(row.status).toBe("active");

    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { "24h_session": sessionCookies["24h_session"] },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe("alice");
    expect(me.json().role).toBe("admin");
  });

  it("does not auto-grant super_admin and is idempotent across logins", async () => {
    oidc = await startMockOidc();
    enableOidc(oidc);
    ctx = await createTestContext();

    for (let i = 0; i < 2; i += 1) {
      const start = await ctx.app.inject({ method: "GET", url: "/api/auth/oidc/start" });
      const startCookies = parseCookies(start.headers["set-cookie"]);
      const flow = decodeFlow(startCookies["24h_oidc"]);
      const state = new URL(String(start.headers.location)).searchParams.get("state");

      oidc.setClaims({ sub: "ext-2", nonce: flow.nonce, email: "bob@example.com" });

      const callback = await ctx.app.inject({
        method: "GET",
        url: `/api/auth/oidc/callback?code=code-${i}&state=${state}`,
        cookies: { "24h_oidc": startCookies["24h_oidc"] },
      });
      expect(callback.statusCode).toBe(302);
    }

    const rows = ctx.db
      .prepare("SELECT role FROM users WHERE external_id = ?")
      .all("ext-2") as { role: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
  });

  it("rejects a mismatched state", async () => {
    oidc = await startMockOidc();
    enableOidc(oidc);
    ctx = await createTestContext();

    const start = await ctx.app.inject({ method: "GET", url: "/api/auth/oidc/start" });
    const startCookies = parseCookies(start.headers["set-cookie"]);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/oidc/callback?code=x&state=wrong",
      cookies: { "24h_oidc": startCookies["24h_oidc"] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("OIDC_STATE_MISMATCH");
  });
});
