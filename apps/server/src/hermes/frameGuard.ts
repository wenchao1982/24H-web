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
  /** `params.session_id` 的非空字符串（`_SessionScoped` 方法 fail-closed 判据）。 */
  sessionId?: string;
  elements?: FrameClassification[];
}

/**
 * 豁免清单（26 条）：参数类 schema **未声明 `profile` 字段**的方法（从官方
 * `contracts/*.py` 机械派生，见 `.psd/.../contracts-evidence.md` MethodSweep 小节）。
 *
 * 判据唯一 = schema 是否声明 `profile`；**不得**以「是否直继 `Params`」判断 ——
 * `Params` 设 `ConfigDict(extra="forbid")`，向无该字段的类注入会得到 4000。
 * 未知方法不在清单内 → 按需 profile 处理（注入或 403），保证 default-deny。
 * 契约变更时须重新 MethodSweep 并同步本清单与全部文档（R14 / Q-010）。
 */
export const PROFILE_AGNOSTIC_METHODS: ReadonlySet<string> = new Set([
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
]);

/**
 * `_SessionScoped` 方法（R24，TASK-036）：参数类 schema **无 `profile` 字段**
 * （故不可注入，否则 `extra="forbid"` → 4000），但其 handler 在缺 `session_id`
 * 时回退到**启动 profile** 的配置（`tools_mcp_plugins.py:20-21`）→ 跨租户读取。
 *
 * fail-closed：非 `super_admin` 且未带 `params.profile` 时，
 * **无 `session_id` → 拒绝**（阻断「回退启动 profile」这条路）。
 *
 * **R24 彻底闭合（session 归属校验）**：当调用方提供 `sessionOwners`
 * （per-connection：runtime/stored session_id → 所属 profile，由 `proxy.ts` 从
 * `session.create` / `session.resume` / `session.activate` 回包累积）时，
 * 带 `session_id` 的请求须**归属命中且在该调用者已分配 profile 内**才放行；
 * 未知 / 他人会话一律拒绝。未提供 `sessionOwners` 时保持旧行为（带 `session_id` 放行），
 * 兼容不维护归属表的既有单测。
 */
export const SESSION_SCOPED_NO_PROFILE_METHODS: ReadonlySet<string> = new Set([
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

function readSessionId(params: unknown): string | undefined {
  if (!isRecord(params)) {
    return undefined;
  }
  const sessionId = params.session_id;
  return typeof sessionId === "string" && sessionId.trim() !== "" ? sessionId.trim() : undefined;
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
      sessionId: readSessionId(parsed.params),
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
 * - 未带 profile 且命中 `_SessionScoped` 方法（R24）→ 按 session 归属校验（见下），否则 deny
 * - 未带 profile 且命中豁免清单 → allow
 * - 未带 profile 且未命中豁免 → 注入调用者 `default_profile`；无可用 → deny
 *
 * R24：`sessionOwners` 提供时，`_SessionScoped` 方法须 `session_id` 归属命中且
 * 落在调用者已分配 profile 内才 allow；未知/他人会话 deny。缺 `sessionOwners` 时
 * 退化为「有 `session_id` 即 allow」（兼容既有调用方）。
 */
export function decideProfileGuard(
  frame: FrameClassification,
  user: GuardUser,
  db: Db,
  sessionOwners?: ReadonlyMap<string, string>,
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

  // R24（TASK-036）：`_SessionScoped` 无 `profile` 字段 → 先于豁免清单判定。
  // 缺 `session_id` 时 handler 会回退「启动 profile」，故 fail-closed 拒绝。
  if (SESSION_SCOPED_NO_PROFILE_METHODS.has(frame.method)) {
    if (frame.sessionId === undefined) {
      return { action: "deny" };
    }
    // 提供归属表时，逐条校验该 session 属于调用者已分配 profile；否则拒绝。
    if (sessionOwners) {
      const owner = sessionOwners.get(frame.sessionId);
      if (owner === undefined || !userCanAccessProfile(db, user.id, owner)) {
        return { action: "deny" };
      }
    }
    return { action: "allow" };
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
  sessionOwners?: ReadonlyMap<string, string>,
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
    const decision = decideProfileGuard(classification, user, db, sessionOwners);
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
      const decision = decideProfileGuard(elementClassification, user, db, sessionOwners);
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
