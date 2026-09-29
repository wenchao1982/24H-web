import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db";
import { migrate } from "../db/migrate";
import {
  PROFILE_AGNOSTIC_METHODS,
  classifyFrame,
  decideProfileGuard,
  guardClientFrame,
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

  it("allows `tools.list` (_SessionScoped, schema without profile) to avoid a 4000", () => {
    const frame = classify({ jsonrpc: "2.0", id: 8, method: "tools.list", params: {} });
    expect(decideProfileGuard(frame, adminWithProfile, db)).toEqual({ action: "allow" });
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

  it("pins the exemption list to exactly 18 methods", () => {
    expect(PROFILE_AGNOSTIC_METHODS.size).toBe(18);
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
});
