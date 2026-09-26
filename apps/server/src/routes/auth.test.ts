import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  type TestContext,
} from "../test/helpers";
import { createUser } from "../users/repo";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials and sets an HttpOnly session cookie", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: {
        id: expect.any(Number),
        username: TEST_ADMIN_USERNAME,
        role: "super_admin",
        must_change_password: 1,
      },
    });

    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("24h_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("rejects a wrong password with 401 INVALID_CREDENTIALS", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: TEST_ADMIN_USERNAME, password: "wrong-password" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a disabled user with 401", async () => {
    ctx = await createTestContext();
    const user = await createUser(ctx.db, {
      username: "bob",
      password: "bob-password-123",
      role: "admin",
    });
    ctx.db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(user.id);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "bob-password-123" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects an unknown user with 401", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "nobody", password: "whatever" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an empty payload with 400", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("INVALID_INPUT");
  });
});
