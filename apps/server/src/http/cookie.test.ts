import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "../test/helpers";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("cookie plugin", () => {
  it("can set and read cookies through inject", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_set", async (_request, reply) => {
      reply.setCookie("t", "v", { path: "/" });
      return { ok: true };
    });
    ctx.app.get("/_read", async (request) => ({ t: request.cookies.t ?? null }));

    const setRes = await ctx.app.inject({ method: "GET", url: "/_set" });
    expect(setRes.statusCode).toBe(200);
    expect(setRes.headers["set-cookie"]).toContain("t=v");

    const readRes = await ctx.app.inject({
      method: "GET",
      url: "/_read",
      cookies: { t: "v" },
    });
    expect(readRes.json()).toEqual({ t: "v" });
  });
});
