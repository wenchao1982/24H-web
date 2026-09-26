import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "../test/helpers";
import { ApiError } from "./errors";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("error handler", () => {
  it("returns the { error, message } envelope for ApiError", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_boom", async () => {
      throw new ApiError(418, "TEAPOT", "nope");
    });

    const res = await ctx.app.inject({ method: "GET", url: "/_boom" });

    expect(res.statusCode).toBe(418);
    expect(res.json()).toEqual({ error: "TEAPOT", message: "nope" });
  });

  it("hides internal error details behind a 500 envelope", async () => {
    ctx = await createTestContext();
    ctx.app.get("/_crash", async () => {
      throw new Error("secret detail");
    });

    const res = await ctx.app.inject({ method: "GET", url: "/_crash" });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "INTERNAL_ERROR", message: "Internal Server Error" });
  });
});
