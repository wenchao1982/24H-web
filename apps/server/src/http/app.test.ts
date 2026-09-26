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
});
