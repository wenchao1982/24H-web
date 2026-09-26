import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  parseCookies,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  type TestContext,
} from "../test/helpers";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

function setCookieList(res: { headers: Record<string, unknown> }): string[] {
  const raw = res.headers["set-cookie"];
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  return typeof raw === "string" ? [raw] : [];
}

describe("CSRF double-submit guard", () => {
  it("rejects an unsafe /api request without the header", async () => {
    ctx = await createTestContext();
    ctx.app.post("/api/_write", async () => ({ ok: true }));

    const res = await ctx.app.inject({ method: "POST", url: "/api/_write" });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("CSRF_REQUIRED");
  });

  it("accepts a matching cookie + header", async () => {
    ctx = await createTestContext();
    ctx.app.post("/api/_write", async () => ({ ok: true }));

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
    });
    const cookies = parseCookies(login.headers["set-cookie"]);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/_write",
      cookies,
      headers: { "x-csrf-token": cookies["24h_csrf"] },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects a mismatched header", async () => {
    ctx = await createTestContext();
    ctx.app.post("/api/_write", async () => ({ ok: true }));

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
    });
    const cookies = parseCookies(login.headers["set-cookie"]);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/_write",
      cookies,
      headers: { "x-csrf-token": "not-the-same" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("does not require a token for safe methods", async () => {
    ctx = await createTestContext();
    ctx.app.get("/api/_read", async () => ({ ok: true }));

    const res = await ctx.app.inject({ method: "GET", url: "/api/_read" });

    expect(res.statusCode).toBe(200);
  });

  it("issues a non-HttpOnly csrf cookie on login", async () => {
    ctx = await createTestContext();

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
    });

    const list = setCookieList(login);
    const csrfCookie = list.find((entry) => entry.startsWith("24h_csrf="));
    const sessionCookie = list.find((entry) => entry.startsWith("24h_session="));

    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toContain("HttpOnly");
    expect(sessionCookie).toContain("HttpOnly");
  });
});
