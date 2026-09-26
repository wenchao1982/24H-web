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

function login(context: TestContext, password: string) {
  return context.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: TEST_ADMIN_USERNAME, password },
  });
}

describe("login rate limiting", () => {
  it("locks after 5 consecutive failures and returns 429", async () => {
    ctx = await createTestContext();

    for (let i = 1; i <= 4; i += 1) {
      const res = await login(ctx, "wrong-password");
      expect(res.statusCode).toBe(401);
    }

    const fifth = await login(ctx, "wrong-password");
    expect(fifth.statusCode).toBe(429);
    expect(fifth.json().error).toBe("LOGIN_LOCKED");

    const sixth = await login(ctx, "wrong-password");
    expect(sixth.statusCode).toBe(429);
  });

  it("rejects the correct password while locked", async () => {
    ctx = await createTestContext();

    for (let i = 0; i < 5; i += 1) {
      await login(ctx, "wrong-password");
    }

    const res = await login(ctx, TEST_ADMIN_PASSWORD);
    expect(res.statusCode).toBe(429);
  });

  it("resets the counter after a successful login", async () => {
    ctx = await createTestContext();

    for (let i = 0; i < 3; i += 1) {
      const res = await login(ctx, "wrong-password");
      expect(res.statusCode).toBe(401);
    }

    const ok = await login(ctx, TEST_ADMIN_PASSWORD);
    expect(ok.statusCode).toBe(200);

    for (let i = 0; i < 4; i += 1) {
      const res = await login(ctx, "wrong-password");
      expect(res.statusCode).toBe(401);
    }
  });
});
