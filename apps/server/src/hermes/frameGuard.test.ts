import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type Db } from "../db";
import { migrate } from "../db/migrate";
import {
  PROFILE_AGNOSTIC_METHODS,
  SESSION_SCOPED_NO_PROFILE_METHODS,
  classifyFrame,
  decideProfileGuard,
  guardClientFrame,
  invalidAttachmentFrame,
  validateAttachmentMagic,
  type FrameClassification,
  type GuardUser,
} from "./frameGuard";

/**
 * 纯单测：用 in-memory SQLite（真实 `user_profiles` 语义）覆盖
 * 「已分配 profile / 无任何 profile」两种租户状态，不启动 WS。
 */
let db: Db;
let superAdmin: GuardUser;
let adminWithProfile: GuardUser;
let adminNoProfile: GuardUser;

const now = Date.now();

beforeAll(() => {
  db = openDb(":memory:");
  migrate(db);
  const insertUser = db.prepare(
    `INSERT INTO users
       (id, username, password_hash, role, status, must_change_password, created_at, updated_at)
     VALUES (?, ?, 'x', ?, 'active', 0, ?, ?)`,
  );
  insertUser.run(1, "root", "super_admin", now, now);
  insertUser.run(2, "alice", "admin", now, now);
  insertUser.run(3, "bob", "admin", now, now);

  const insertProfile = db.prepare(
    "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, ?, ?)",
  );
  insertProfile.run(2, "alpha", 1, now);
  insertProfile.run(2, "beta", 0, now);
  // bob 无任何已分配 profile（仅 id=2 有分配）。

  superAdmin = { id: 1, role: "super_admin" };
  adminWithProfile = { id: 2, role: "admin" };
  adminNoProfile = { id: 3, role: "admin" };
});

afterAll(() => {
  db.close();
});

function text(value: unknown): string {
  return JSON.stringify(value);
}

function classify(value: unknown): FrameClassification {
  return classifyFrame(text(value), false);
}

describe("classifyFrame", () => {
  it("classifies a method-bearing object as a request", () => {
    const frame = classify({ jsonrpc: "2.0", id: 1, method: "ping", params: {} });
    expect(frame.kind).toBe("request");
    expect(frame.method).toBe("ping");
    expect(frame.id).toBe(1);
  });

  it("classifies binary data as binary regardless of payload", () => {
    expect(classifyFrame(text({ method: "ping" }), true).kind).toBe("binary");
  });

  it("classifies unparsable text as invalid", () => {
    expect(classifyFrame("not json", false).kind).toBe("invalid");
  });

  it("classifies a non-string method as invalid", () => {
    expect(classifyFrame(text({ method: 123 }), false).kind).toBe("invalid");
  });

  it("classifies an array as a batch and classifies every element", () => {
    const frame = classify([
      { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
      { id: 2, result: {} },
    ]);
    expect(frame.kind).toBe("batch");
    expect(frame.elements).toHaveLength(2);
    expect(frame.elements?.[0].kind).toBe("request");
    expect(frame.elements?.[0].method).toBe("ping");
    expect(frame.elements?.[1].kind).toBe("response");
  });

  it("classifies a method-less frame with an id as a response", () => {
    const frame = classify({ id: 1, result: {} });
    expect(frame.kind).toBe("response");
    expect(frame.id).toBe(1);
  });

  it("classifies a method-bearing frame without an id as a request (default-deny, not a notification)", () => {
    const frame = classify({ jsonrpc: "2.0", method: "x" });
    expect(frame.kind).toBe("request");
    expect(frame.method).toBe("x");
  });

  it("classifies a frame without method or id as a notification", () => {
    expect(classify({ jsonrpc: "2.0" }).kind).toBe("notification");
  });

  it.each([
    ["null", null],
    ["number", 42],
    ["string", "hello"],
    ["boolean", true],
  ])("classifies a bare %s as invalid", (_label, value) => {
    expect(classify(value).kind).toBe("invalid");
  });
});

describe("decideProfileGuard", () => {
  it("allows a super_admin unconditionally", () => {
    const frame = classify({ jsonrpc: "2.0", id: 1, method: "session.list", params: {} });
    expect(decideProfileGuard(frame, superAdmin, db)).toEqual({ action: "allow" });
  });

  it("allows an admin for an assigned profiles", () => {
    const frame = classify({
      jsonrpc: "2.0",
      id: 2,
      method: "prompt.submit",
      params: { profile: "beta" },
    });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "allow" });
  });

  it("denies an admin for an unassigned explicit profile", () => {
    const frame = classify({
      jsonrpc: "2.0",
      id: 3,
      method: "session.create",
      params: { profile: "px" },
    });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "deny" });
  });

  it("allows an exempt method without profile", () => {
    const frame = classify({ jsonrpc: "2.0", id: 4, method: "ping", params: {} });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "allow" });
  });

  it("injects the default profile for a non-exempt method without profile", () => {
    const frame = classify({ jsonrpc: "2.0", id: 5, method: "session.list", params: {} });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({
      action: "inject",
      profile: "alpha",
    });
  });

  it("injects for an unknown method (default-deny, never allow)", () => {
    const frame = classify({ jsonrpc: "2.0", id: 6, method: "totally.unknown", params: {} });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({
      action: "inject",
      profile: "alpha",
    });
  });

  it("injects for `complete.path` which is not on the exemption list", () => {
    const frame = classify({ jsonrpc: "2.0", id: 7, method: "complete.path", params: {} });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({
      action: "inject",
      profile: "alpha",
    });
  });

  it("allows `tools.list` (_SessionScoped, schema without profile) when it carries a session_id", () => {
    const frame = classify({
      jsonrpc: "2.0",
      id: 8,
      method: "tools.list",
      params: { session_id: "runtime:s1" },
    });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "allow" });
  });

  it("denies `tools.list` without session_id (R24 fail-closed: no fallback to startup profile)", () => {
    const frame = classify({ jsonrpc: "2.0", id: 81, method: "tools.list", params: {} });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "deny" });
  });

  it("denies `toolsets.list` / `tools.show` without session_id", () => {
    for (const method of ["toolsets.list", "tools.show"]) {
      const frame = classify({ jsonrpc: "2.0", id: 82, method, params: {} });
      expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "deny" });
    }
  });

  it("allows `tools.list` without session_id for a super_admin (no guard)", () => {
    const frame = classify({ jsonrpc: "2.0", id: 83, method: "tools.list", params: {} });
    expect(decideProfileGuard(frame, superAdmin, db)).toEqual({ action: "allow" });
  });

  it("allows `tools.list` when the session owner is an assigned profile (R24)", () => {
    const frame = classify({
      jsonrpc: "2.0",
      id: 84,
      method: "tools.list",
      params: { session_id: "r1" },
    });
    const owners = new Map<string, string>([["r1", "alpha"]]);
    expect(decideProfileGuard(frame, adminWithProfile, db, owners)).toEqual({ action: "allow" });
  });

  it("denies `tools.list` when the session owner is unassigned (R24)", () => {
    const frame = classify({
      jsonrpc: "2.0",
      id: 85,
      method: "tools.list",
      params: { session_id: "r1" },
    });
    const owners = new Map<string, string>([["r1", "gamma"]]);
    expect(decideProfileGuard(frame, adminWithProfile, db, owners)).toEqual({ action: "deny" });
  });

  it("denies `tools.list` for an unknown session id when owners are tracked (R24)", () => {
    const frame = classify({
      jsonrpc: "2.0",
      id: 86,
      method: "tools.list",
      params: { session_id: "unknown" },
    });
    const owners = new Map<string, string>([["r1", "alpha"]]);
    expect(decideProfileGuard(frame, adminWithProfile, db, owners)).toEqual({ action: "deny" });
  });

  // R24 扩展：豁免 ∩ 声明 session_id 的 (A) 类方法（MethodSweep + 逐条读 handler）。
  const newSessionScopedMethods = [
    "skills.reload",
    "complete.slash",
    "model.save_key",
    "model.disconnect",
  ];

  it.each(newSessionScopedMethods)(
    "denies `%s` without session_id (R24 fail-closed: no fallback to startup profile)",
    (method) => {
      const frame = classify({ jsonrpc: "2.0", id: 90, method, params: {} });
      expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "deny" });
    },
  );

  it.each(newSessionScopedMethods)(
    "allows `%s` when the session owner is an assigned profile (R24)",
    (method) => {
      const frame = classify({
        jsonrpc: "2.0",
        id: 91,
        method,
        params: { session_id: "r1" },
      });
      const owners = new Map<string, string>([["r1", "alpha"]]);
      expect(decideProfileGuard(frame, adminWithProfile, db, owners)).toEqual({ action: "allow" });
    },
  );

  it.each(newSessionScopedMethods)(
    "denies `%s` when the session_id is unknown or foreign (R24)",
    (method) => {
      const frame = classify({
        jsonrpc: "2.0",
        id: 92,
        method,
        params: { session_id: "foreign" },
      });
      const owners = new Map<string, string>([["r1", "alpha"]]);
      expect(decideProfileGuard(frame, adminWithProfile, db, owners)).toEqual({ action: "deny" });
    },
  );

  it.each(newSessionScopedMethods)(
    "allows `%s` without session_id for a super_admin (no guard)",
    (method) => {
      const frame = classify({ jsonrpc: "2.0", id: 93, method, params: {} });
      expect(decideProfileGuard(frame, superAdmin, db)).toEqual({ action: "allow" });
    },
  );

  it("pins the session-scoped list to exactly the audited (A)-class set (R24)", () => {
    // (A) 类 = 豁免 ∩ 声明 session_id，且 handler 缺/未知 session_id 时回退启动 profile。
    const expected = [
      "tools.list",
      "toolsets.list",
      "tools.show",
      "skills.reload",
      "complete.slash",
      "model.save_key",
      "model.disconnect",
    ];
    expect([...SESSION_SCOPED_NO_PROFILE_METHODS].sort()).toEqual([...expected].sort());
    expect(SESSION_SCOPED_NO_PROFILE_METHODS.size).toBe(7);
  });

  it("injects for `commands.catalog` whose schema declares profile", () => {
    const frame = classify({ jsonrpc: "2.0", id: 9, method: "commands.catalog", params: {} });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({
      action: "inject",
      profile: "alpha",
    });
  });

  it("denies when the admin has no assigned profile at all", () => {
    const frame = classify({ jsonrpc: "2.0", id: 10, method: "session.list", params: {} });
    expect(decideProfileGuard(frame, adminNoProfile, db)).toEqual({ action: "deny" });
  });

  it("pins the exemption list to exactly the mechanically derived set (MethodSweep)", () => {
    // 机械核验：`tui_gateway.contracts` 注册表里参数类 schema 未声明 `profile` 字段的
    // 方法集合（26 条）。契约变更时须重跑 MethodSweep 并同步本清单与全部文档（R14）。
    const expected = [
      "ping",
      "gateway.capabilities",
      "client.capabilities",
      "complete.slash",
      "reload.env",
      "reload.mcp",
      "plugins.list",
      "skills.reload",
      "learning.frames",
      "learning.detail",
      "learning.delete",
      "learning.edit",
      "paste.collapse",
      "model.save_key",
      "model.disconnect",
      "diagnostics.share_nous",
      "image.generate",
      "onboarding.ensure_setup_profile",
      "onboarding.reset_setup_profile",
      "tools.list",
      "toolsets.list",
      "tools.show",
      "browser.controller.register",
      "browser.controller.heartbeat",
      "browser.controller.detach",
      "browser.controller.result",
    ];
    expect([...PROFILE_AGNOSTIC_METHODS].sort()).toEqual([...expected].sort());
    expect(PROFILE_AGNOSTIC_METHODS.size).toBe(26);
  });
});

describe("guardClientFrame", () => {
  it("rejects the notification-ised bypass (no id, explicit foreign profile)", () => {
    const raw = text({
      jsonrpc: "2.0",
      method: "session.create",
      params: { profile: "px" },
    });
    expect(guardClientFrame(raw, false, adminWithProfile, db)).toEqual({
      action: "reject",
      code: "PROFILE_FORBIDDEN",
      id: null,
    });
  });

  it("rejects the extra-member bypass (error:null does not make it a response)", () => {
    const raw = text({
      jsonrpc: "2.0",
      method: "session.create",
      params: { profile: "px" },
      error: null,
    });
    expect(guardClientFrame(raw, false, adminWithProfile, db)).toEqual({
      action: "reject",
      code: "PROFILE_FORBIDDEN",
      id: null,
    });
  });

  it("rejects a batch that contains a forbidden element", () => {
    const raw = text([
      { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
      { jsonrpc: "2.0", id: 2, method: "session.create", params: { profile: "px" } },
    ]);
    expect(guardClientFrame(raw, false, adminWithProfile, db)).toEqual({
      action: "reject",
      code: "PROFILE_FORBIDDEN",
      id: null,
    });
  });

  it("rejects binary frames", () => {
    expect(guardClientFrame(text({ method: "ping" }), true, adminWithProfile, db)).toEqual({
      action: "reject",
      code: "INVALID_FRAME",
      id: null,
    });
  });

  it("rejects unparsable frames", () => {
    expect(guardClientFrame("not json", false, adminWithProfile, db)).toEqual({
      action: "reject",
      code: "INVALID_FRAME",
      id: null,
    });
  });

  it("forwards a method-less client response unchanged", () => {
    const raw = text({ id: 9, result: { x: 1 } });
    expect(guardClientFrame(raw, false, adminWithProfile, db)).toEqual({
      action: "forward",
      text: raw,
      injected: false,
    });
  });

  it("forwards an exempt frame without injecting", () => {
    const raw = text({ jsonrpc: "2.0", id: 1, method: "ping", params: {} });
    const outcome = guardClientFrame(raw, false, adminWithProfile, db);
    expect(outcome).toEqual({ action: "forward", text: raw, injected: false });
  });

  it("rejects `tools.list` without session_id for an admin (R24 fail-closed)", () => {
    const raw = text({ jsonrpc: "2.0", id: 7, method: "tools.list", params: {} });
    expect(guardClientFrame(raw, false, adminWithProfile, db)).toEqual({
      action: "reject",
      code: "PROFILE_FORBIDDEN",
      id: 7,
    });
  });

  it("forwards `tools.list` with a session_id owned by an assigned profile (R24)", () => {
    const raw = text({
      jsonrpc: "2.0",
      id: 8,
      method: "tools.list",
      params: { session_id: "r1" },
    });
    const owners = new Map<string, string>([["r1", "alpha"]]);
    expect(guardClientFrame(raw, false, adminWithProfile, db, owners)).toEqual({
      action: "forward",
      text: raw,
      injected: false,
    });
  });

  it("rejects `tools.list` when the session_id is not owned by the caller (R24)", () => {
    const raw = text({
      jsonrpc: "2.0",
      id: 8,
      method: "tools.list",
      params: { session_id: "runtime:other" },
    });
    const owners = new Map<string, string>([["runtime:x", "alpha"]]);
    expect(guardClientFrame(raw, false, adminWithProfile, db, owners)).toEqual({
      action: "reject",
      code: "PROFILE_FORBIDDEN",
      id: 8,
    });
  });

  it("forwards a non-exempt frame with the default profile injected", () => {
    const raw = text({ jsonrpc: "2.0", id: 5, method: "session.list", params: {} });
    const outcome = guardClientFrame(raw, false, adminWithProfile, db);
    expect(outcome.action).toBe("forward");
    if (outcome.action !== "forward") {
      throw new Error("expected forward");
    }
    expect(outcome.injected).toBe(true);
    expect(outcome.text).toContain('"profile":"alpha"');
  });

  it("rejects an attachment with invalid magic bytes (REQ-023)", () => {
    const raw = text({
      jsonrpc: "2.0",
      id: 71,
      method: "image.attach_bytes",
      params: {
        content_base64: Buffer.alloc(41, 0x41).toString("base64"),
        filename: "fake.png",
      },
    });
    const outcome = guardClientFrame(raw, false, adminWithProfile, db);
    expect(outcome.action).toBe("reject");
    if (outcome.action !== "reject") {
      throw new Error("expected reject");
    }
    expect(outcome.code).toBe("INVALID_ATTACHMENT_TYPE");
    expect(outcome.id).toBe(71);
    expect(outcome.message).toBeTruthy();
  });

  it("does not type-check attachments for a super_admin", () => {
    const raw = text({
      jsonrpc: "2.0",
      id: 72,
      method: "image.attach_bytes",
      params: { content_base64: Buffer.alloc(41, 0x41).toString("base64") },
    });
    expect(guardClientFrame(raw, false, superAdmin, db).action).toBe("forward");
  });

  it("rejects a batch containing an attachment with invalid magic bytes (REQ-023)", () => {
    const raw = text([
      { jsonrpc: "2.0", id: 73, method: "ping", params: {} },
      {
        jsonrpc: "2.0",
        id: 74,
        method: "pdf.attach",
        params: { content_base64: Buffer.from("not a pdf").toString("base64") },
      },
    ]);
    const outcome = guardClientFrame(raw, false, adminWithProfile, db);
    expect(outcome.action).toBe("reject");
    if (outcome.action !== "reject") {
      throw new Error("expected reject");
    }
    expect(outcome.code).toBe("INVALID_ATTACHMENT_TYPE");
  });

  it("builds the INVALID_ATTACHMENT_TYPE error frame with the same id", () => {
    const frame = JSON.parse(invalidAttachmentFrame(9, "坏图"));
    expect(frame).toEqual({
      jsonrpc: "2.0",
      id: 9,
      error: { code: 400, message: "坏图", data: { code: "INVALID_ATTACHMENT_TYPE" } },
    });
  });
});

describe("validateAttachmentMagic (REQ-023)", () => {
  const PNG = Buffer.from("89504e470d0a1a0a", "hex");
  const JPEG = Buffer.from("ffd8ff", "hex");
  const GIF = Buffer.from("GIF89a", "latin1");
  const BMP = Buffer.from("BM", "latin1");
  // RIFF + 4 字节尺寸 + WEBP
  const WEBP = Buffer.from("524946460000000057454250", "hex");
  const TIFF_LE = Buffer.from("49492a00", "hex"); // "II*\0"
  const TIFF_BE = Buffer.from("4d4d002a", "hex"); // "MM\0*"
  const ICO = Buffer.from("00000100", "hex");
  const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
  const SVG_XML = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>', "utf8");
  const PDF = Buffer.from("%PDF-1.4", "latin1");

  const payloadOf = (magic: Buffer): string =>
    Buffer.concat([magic, Buffer.alloc(32, 7)]).toString("base64");

  function attach(
    method: string,
    params: Record<string, unknown>,
  ): { frame: FrameClassification; parsed: unknown } {
    const parsed = { jsonrpc: "2.0", id: 1, method, params };
    return { frame: classify(parsed), parsed };
  }

  it.each([
    ["PNG", PNG],
    ["JPEG", JPEG],
    ["GIF", GIF],
    ["BMP", BMP],
    ["WebP", WEBP],
    ["TIFF (little-endian)", TIFF_LE],
    ["TIFF (big-endian)", TIFF_BE],
    ["ICO", ICO],
    ["SVG (<svg)", SVG],
    ["SVG (<?xml)", SVG_XML],
  ])("accepts a valid %s image payload", (_label, magic) => {
    const { frame, parsed } = attach("image.attach_bytes", {
      content_base64: payloadOf(magic),
    });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("accepts an SVG payload preceded by a UTF-8 BOM and whitespace", () => {
    const payload = Buffer.concat([Buffer.from("\uFEFF  \n", "utf8"), SVG]);
    const { frame, parsed } = attach("image.attach_bytes", {
      content_base64: Buffer.concat([payload, Buffer.alloc(32, 7)]).toString("base64"),
    });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("accepts a PDF payload starting with %PDF-", () => {
    const { frame, parsed } = attach("pdf.attach", { content_base64: PDF.toString("base64") });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("rejects 41 bytes of non-image text disguised as an image", () => {
    const { frame, parsed } = attach("image.attach_bytes", {
      content_base64: Buffer.alloc(41, 0x41).toString("base64"),
      filename: "fake.png",
    });
    const result = validateAttachmentMagic(frame, parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("图片");
    }
  });

  it("rejects non-%PDF- bytes disguised as a PDF", () => {
    const { frame, parsed } = attach("pdf.attach", {
      content_base64: Buffer.from("definitely not a pdf").toString("base64"),
      filename: "fake.pdf",
    });
    const result = validateAttachmentMagic(frame, parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("PDF");
    }
  });

  it("handles a data: URL base64 wrapper", () => {
    const { frame, parsed } = attach("image.attach_bytes", {
      content_base64: `data:image/png;base64,${payloadOf(PNG)}`,
    });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("reads the `data` fallback field", () => {
    const { frame, parsed } = attach("image.attach_bytes", { data: payloadOf(PNG) });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("ignores whitespace/newlines inside the payload", () => {
    const { frame, parsed } = attach("image.attach_bytes", {
      content_base64: payloadOf(PNG).replace(/(.{8})/g, "$1\n"),
    });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("skips validation when only a path is given (no base64 payload)", () => {
    const { frame, parsed } = attach("pdf.attach", { path: "/tmp/x.pdf" });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("does not constrain file.attach (any file allowed)", () => {
    const { frame, parsed } = attach("file.attach", {
      data_url: "data:text/plain;base64,QUFB",
      name: "a.txt",
    });
    expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
  });

  it("ignores non-request frames", () => {
    expect(validateAttachmentMagic({ kind: "response", id: 1 }, {})).toEqual({ ok: true });
    expect(validateAttachmentMagic({ kind: "request", method: "ping" }, {})).toEqual({ ok: true });
  });

  it("decodes only a short prefix, never the whole payload (REQ-023 perf)", () => {
    const huge = payloadOf(PNG) + "A".repeat(20 * 1024 * 1024);
    const { frame, parsed } = attach("image.attach_bytes", { content_base64: huge });
    const spy = vi.spyOn(Buffer, "from");
    try {
      expect(validateAttachmentMagic(frame, parsed)).toEqual({ ok: true });
      const stringArgs = spy.mock.calls
        .map((call) => call[0])
        .filter((value): value is string => typeof value === "string");
      expect(stringArgs.length).toBeGreaterThan(0);
      expect(stringArgs).toContain(huge.slice(0, 48));
      expect(stringArgs.some((value) => value.length > 64)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
