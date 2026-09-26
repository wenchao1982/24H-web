import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "../test/helpers";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("buildApp", () => {
  it("responds to GET /health", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("accepts and echoes a provided x-request-id", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "abc-123" },
    });

    expect(res.headers["x-request-id"]).toBe("abc-123");
  });

  it("generates a request id when none was provided", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "GET", url: "/health" });

    const id = res.headers["x-request-id"];
    expect(typeof id).toBe("string");
    expect((id as string).length).toBeGreaterThan(0);
  });
});
