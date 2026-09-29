import type { Db } from "../db";
import { resolveDefaultProfile, userCanAccessProfile } from "../users/repo";

/**
 * WS JSON-RPC 帧分类与租户守卫（Spec 003 REQ-008 / REQ-017）。
 *
 * 唯一判据：解析后是否含 `method` 字符串 —— 一律按 request 处理，**不得**以
 * 「无 id＝通知」「带 result/error＝响应」「数组/二进制放行」为由免拦。
 */

export type FrameKind =
  | "request"
  | "response"
  | "notification"
  | "batch"
  | "invalid"
  | "binary";

export interface FrameClassification {
  kind: FrameKind;
  id?: number | string;
  method?: string;
  profile?: string;
  elements?: FrameClassification[];
}

/**
 * 豁免清单：参数类 schema **未声明 `profile` 字段**的方法（从官方 `contracts/*.py` 派生）。
 *
 * 判据唯一 = schema 是否声明 `profile`；**不得**以「是否直继 `Params`」判断 ——
 * `Params` 设 `ConfigDict(extra="forbid")`，向无该字段的类注入会得到 4000。
 * 未知方法不在清单内 → 按需 profile 处理（注入或 403），保证 default-deny。
 */
export const PROFILE_AGNOSTIC_METHODS: ReadonlySet<string> = new Set([
  "ping",
  "gateway.capabilities",
  "client.capabilities",
  "complete.slash",
  "reload.env",
  "reload.mcp",
  "plugins.list",
  "learning.frames",
  "learning.detail",
  "learning.delete",
  "paste.collapse",
  "model.save_key",
  "model.disconnect",
  "diagnostics.share_nous",
  "image.generate",
  "tools.list",
  "toolsets.list",
  "tools.show",
]);

export interface GuardUser {
  id: number;
  role: string;
}

export type GuardAction = "allow" | "inject" | "deny";

export interface GuardDecision {
  action: GuardAction;
  /** `inject` 时的目标 profile */
  profile?: string;
}

export type GuardOutcome =
  | { action: "forward"; text: string; injected: boolean }
  | { action: "reject"; code: "PROFILE_FORBIDDEN" | "INVALID_FRAME"; id: number | string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(value: unknown): number | string | undefined {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return undefined;
}

function readProfile(params: unknown): string | undefined {
  if (!isRecord(params)) {
    return undefined;
  }
  const profile = params.profile;
  return typeof profile === "string" && profile.trim() !== "" ? profile.trim() : undefined;
}

function classifyParsed(parsed: unknown): FrameClassification {
  if (Array.isArray(parsed)) {
    return { kind: "batch", elements: parsed.map((item) => classifyParsed(item)) };
  }
  if (!isRecord(parsed)) {
    return { kind: "invalid" };
  }
  const method = parsed.method;
  if (method !== undefined) {
    // 存在 method 键即按 request 处理；非字符串视为非法并拒绝。
    if (typeof method !== "string" || method === "") {
      return { kind: "invalid" };
    }
    return {
      kind: "request",
      id: readId(parsed.id),
      method,
      profile: readProfile(parsed.params),
    };
  }
  if (parsed.id !== undefined) {
    return { kind: "response", id: readId(parsed.id) };
  }
  return { kind: "notification" };
}

/** 分类一帧文本/二进制数据。二进制与解析失败一律判为不可信。 */
export function classifyFrame(data: string | Uint8Array, isBinary: boolean): FrameClassification {
  if (isBinary) {
    return { kind: "binary" };
  }
  let text: string;
  if (typeof data === "string") {
    text = data;
  } else {
    try {
      text = Buffer.from(data).toString("utf8");
    } catch {
      return { kind: "invalid" };
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "invalid" };
  }
  return classifyParsed(parsed);
}

/**
 * 对单个 request 帧决定处置（default-deny）。
 *
 * - `super_admin` → allow（不注入）
 * - 已带 `params.profile` → 校验归属：可访问 allow，否则 deny
 * - 未带 profile 且命中豁免清单 → allow
 * - 未带 profile 且未命中豁免 → 注入调用者 `default_profile`；无可用 → deny
 */
export function decideProfileGuard(
  frame: FrameClassification,
  user: GuardUser,
  db: Db,
): GuardDecision {
  if (frame.kind !== "request" || !frame.method) {
    return { action: "allow" };
  }
  if (user.role === "super_admin") {
    return { action: "allow" };
  }

  const explicit = frame.profile ?? "";
  if (explicit !== "") {
    return userCanAccessProfile(db, user.id, explicit)
      ? { action: "allow" }
      : { action: "deny" };
  }

  if (PROFILE_AGNOSTIC_METHODS.has(frame.method)) {
    return { action: "allow" };
  }

  const profile = resolveDefaultProfile(db, user.id);
  if (!profile) {
    return { action: "deny" };
  }
  return { action: "inject", profile };
}

function injectIntoElement(element: unknown, profile: string): unknown {
  if (!isRecord(element)) {
    return element;
  }
  const params = isRecord(element.params) ? element.params : {};
  if (readProfile(params) !== undefined) {
    return element;
  }
  return { ...element, params: { ...params, profile } };
}

/**
 * 客户端上行帧的统一守卫入口（default-deny）。
 *
 * - 二进制 / 解析失败 / 非字符串 method → `reject INVALID_FRAME`
 * - 批帧：逐元素判定；**任一元素越权 → 整批拒绝**（不转发任何元素）；否则对需注入的元素注入后整批转发
 * - request：越权 → `reject PROFILE_FORBIDDEN`；需注入 → 注入后转发
 * - 无 `method` 的帧（服务端请求的客户端回包 / 通知）→ 原样转发
 */
export function guardClientFrame(
  raw: string | Uint8Array,
  isBinary: boolean,
  user: GuardUser,
  db: Db,
): GuardOutcome {
  const text = typeof raw === "string" ? raw : safeDecode(raw);
  if (isBinary || text === null) {
    return { action: "reject", code: "INVALID_FRAME", id: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { action: "reject", code: "INVALID_FRAME", id: null };
  }

  const classification = classifyFrame(text, false);
  if (classification.kind === "invalid") {
    return { action: "reject", code: "INVALID_FRAME", id: classification.id ?? null };
  }
  if (classification.kind === "request") {
    const decision = decideProfileGuard(classification, user, db);
    if (decision.action === "deny") {
      return { action: "reject", code: "PROFILE_FORBIDDEN", id: classification.id ?? null };
    }
    if (decision.action === "inject" && decision.profile) {
      const injected = injectIntoElement(parsed, decision.profile);
      return { action: "forward", text: JSON.stringify(injected), injected: true };
    }
    return { action: "forward", text, injected: false };
  }
  if (classification.kind === "batch") {
    const elements = Array.isArray(parsed) ? parsed : [];
    let profile: string | undefined;
    let needsInject = false;
    for (const element of elements) {
      const elementClassification = classifyFrame(JSON.stringify(element), false);
      const decision = decideProfileGuard(elementClassification, user, db);
      if (decision.action === "deny") {
        // 任一元素越权 → 整批拒绝，不转发任何元素。
        return { action: "reject", code: "PROFILE_FORBIDDEN", id: null };
      }
      if (decision.action === "inject" && decision.profile) {
        profile = decision.profile;
        needsInject = true;
      }
    }
    if (needsInject && profile) {
      const next = elements.map((element) => injectIntoElement(element, profile));
      return { action: "forward", text: JSON.stringify(next), injected: true };
    }
    return { action: "forward", text, injected: false };
  }
  // response / notification：服务端请求的客户端回包与通知原样转发。
  return { action: "forward", text, injected: false };
}

function safeDecode(raw: Uint8Array): string | null {
  try {
    return Buffer.from(raw).toString("utf8");
  } catch {
    return null;
  }
}

/** 越权错误帧（同 `id`；批帧为 `null`）。 */
export function profileForbiddenFrame(id: number | string | null): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code: 403,
      message: "无权访问该 profile",
      data: { code: "PROFILE_FORBIDDEN" },
    },
  });
}

/** 非法帧错误（二进制 / 解析失败 / 非字符串 method）。 */
export function invalidFrame(id: number | string | null): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code: 400, message: "非法帧", data: { code: "INVALID_FRAME" } },
  });
}
