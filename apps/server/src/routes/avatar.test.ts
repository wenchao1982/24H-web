import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  loginAndGetCookies,
  type TestContext,
} from "../test/helpers";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function dataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

describe("avatar", () => {
  it("adds the avatar column via migration 002", async () => {
    ctx = await createTestContext();

    const columns = ctx.db.prepare("PRAGMA table_info(users)").all() as { name: string }[];

    expect(columns.map((column) => column.name)).toContain("avatar");
  });

  it("uploads a small PNG and reads it back", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const png = dataUrl("image/png", Buffer.concat([PNG_MAGIC, Buffer.alloc(16)]));

    const put = await ctx.app.inject({
      method: "PUT",
      url: "/api/auth/avatar",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { data: png },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ ok: true });

    const get = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/avatar",
      cookies: { "24h_session": session },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual({ data: png });
  });

  it("accepts a JPEG payload", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const jpeg = dataUrl("image/jpeg", Buffer.concat([JPEG_MAGIC, Buffer.alloc(16)]));

    const put = await ctx.app.inject({
      method: "PUT",
      url: "/api/auth/avatar",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { data: jpeg },
    });

    expect(put.statusCode).toBe(200);
  });

  it("rejects an oversize image with 400", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const big = dataUrl("image/png", Buffer.concat([PNG_MAGIC, Buffer.alloc(256 * 1024)]));

    const put = await ctx.app.inject({
      method: "PUT",
      url: "/api/auth/avatar",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { data: big },
    });

    expect(put.statusCode).toBe(400);
    expect(put.json().error).toBe("AVATAR_TOO_LARGE");
  });

  it("rejects an unsupported mime type with 400", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const gif = dataUrl("image/gif", Buffer.concat([PNG_MAGIC, Buffer.alloc(16)]));

    const put = await ctx.app.inject({
      method: "PUT",
      url: "/api/auth/avatar",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { data: gif },
    });

    expect(put.statusCode).toBe(400);
    expect(put.json().error).toBe("INVALID_AVATAR");
  });

  it("rejects bytes that do not match the declared type", async () => {
    ctx = await createTestContext();
    const { session, csrf } = await loginAndGetCookies(ctx.app);
    const fake = dataUrl("image/png", Buffer.from("this is not a png at all"));

    const put = await ctx.app.inject({
      method: "PUT",
      url: "/api/auth/avatar",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { data: fake },
    });

    expect(put.statusCode).toBe(400);
    expect(put.json().error).toBe("INVALID_AVATAR");
  });

  it("requires authentication", async () => {
    ctx = await createTestContext();

    const res = await ctx.app.inject({ method: "GET", url: "/api/auth/avatar" });

    expect(res.statusCode).toBe(401);
  });
});
