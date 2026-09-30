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
 * 会话归属校验清单（R24，TASK-036）：参数类 schema **无 `profile` 字段**（故不可注入，
 * 否则 `extra="forbid"` → 4000），且 handler 在缺/未知 `session_id` 时**回退到启动
 * profile / launch env**（跨租户读或写）。此为 (A) 类方法；判定**必须早于**豁免清单 allow。
 *
 * 方法集合（MethodSweep 机械筛选「豁免 ∩ 参数类声明 `session_id`」+ 逐条读 handler 判定）：
 * - `tools.list` / `toolsets.list` / `tools.show` — `_SessionScoped`，缺 `session_id` 回退启动
 *   profile 配置（`tui_gateway/contracts/tools_mcp_plugins.py:19-23`，handler `methods_tools.py:44/47/66`）。
 * - `skills.reload` — `_session_home_scope(_sessions.get(params.get("session_id","")))`；unscoped 解析
 *   到启动 profile（`methods_tools.py:1291-1304`；helper docstring `methods_tools.py:591-601`）。
 * - `complete.slash` — 同一 `_session_home_scope(_sessions.get(params.get("session_id","")))`
 *   （`methods_complete.py:276-289`）；缺 session 时读启动 profile 的 skills/bundles。
 * - `model.save_key` / `model.disconnect` — `@_profile_scoped`：无 `profile` 且取不到会话时
 *   `profile_home = None` → 绑定**启动 profile** scope（`server.py:568-595`），对启动 profile
 *   **写入/清除凭证**（handler `methods_complete.py:347-384` / `387-403`）。
 *
 * **不列入**（已复核，非 (A)）：
 * - `browser.controller.{register,result,heartbeat,detach}` — `_controller_method` 缺会话即
 *   `_session_transport_contains(None,…) === false` → 403，fail-closed（`methods_browser_control.py:93-126`；
 *   `session_transports.py:20-25`）。
 * - `reload.mcp` — 有意的**全局**操作（契约 doc「for every live session」）；`_do_full_reload` 显式绑定
 *   `{"profile_home": None}` 后遍历所有已服务 home 重建（`methods_tools.py:361-408`），`session_id`
 *   仅用于 compute-host 路由，不构成启动 profile 回退读取；其全局副作用不在归属校验可闭合范围（另记）。
 *
 * fail-closed：非 `super_admin` 且未带 `params.profile` 时，**无 `session_id` → 拒绝**。
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
  "skills.reload",
  "complete.slash",
  "model.save_key",
  "model.disconnect",
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

export type GuardRejectCode = "PROFILE_FORBIDDEN" | "INVALID_FRAME" | "INVALID_ATTACHMENT_TYPE";

export type GuardOutcome =
  | { action: "forward"; text: string; injected: boolean }
  | { action: "reject"; code: GuardRejectCode; id: number | string | null; message?: string };

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

/**
 * 上传内容类型校验（REQ-023 / R10）。
 *
 * Hermes 端仅按 `_sniff_image_ext` **推断扩展名、不拒绝**（`tui_gateway/prompt_attachments.py:64-71`），
 * 41 字节非图片文本可经 `image.attach_bytes` 被接受；PDF 的 `%PDF-` 校验（`methods_prompt.py:1106-1107`）
 * 被 `pdftoppm` 依赖（`:797-798`）遮蔽（缺 poppler-utils → 5028，分支不可达）。故在 BFF WS 代理侧对
 * `image.attach_bytes` / `pdf.attach` 的 base64 载荷做**前缀** magic bytes 校验。
 *
 * 魔数表**照抄** Hermes 的 `_IMAGE_MAGIC`（`prompt_attachments.py:20-23`，PNG/JPEG/GIF/BMP）
 * + `:69-70` 的 WebP `RIFF`/`WEBP` 判定，并补齐 Hermes **允许但无魔数条目**的格式
 * （TIFF / ICO / SVG；见下）。PDF 为 `methods_prompt.py:1106` 的 `%PDF-`。
 *
 * **两个集合与判定策略**：
 * - **Hermes 允许扩展名**（权威来源 `hermes_cli/cli_terminal_input.py:31-34` 的
 *   `_IMAGE_EXTENSIONS`；经 `prompt_attachments.py:74-79` `_allowed_image_extensions` 消费，
 *   校验点 `methods_prompt.py:775-777`）：`.png .jpg .jpeg .gif .webp .bmp .tiff .tif .svg .ico`。
 *   Hermes 的 `_sniff_image_ext`（`prompt_attachments.py:64-71`）优先取 **filename 后缀**，
 *   仅在后缀缺失时用魔数（未知默认 `.png`）——即**只推断、不拒绝**。
 * - **BFF 接受（可魔数判定）**：PNG / JPEG / GIF / BMP / WebP / TIFF（LE+BE）/ ICO / CUR /
 *   SVG（文本前缀 `<svg` 或 `<?xml`）。
 * 两集合按**扩展名归并**后一致（`.jpeg`→JPEG、`.tif`→TIFF 魔数覆盖、`.svg`→SVG 前缀）。
 * 策略：**能判定则判定、无法判定则拒绝**（fail-closed）。当前无 Hermes 允许却无法判定的
 * 格式；差异与判据见 `design.md §7.7` 与 `contracts-evidence.md`。
 *
 * **仅解码前缀**：前缀长度 `ATTACHMENT_PREFIX_CHARS = 48` 个 base64 字符 ≈ **36 字节**，
 * **禁止整帧解码**（10MB 载荷 base64 后 ≈13.3MB）。相较早期 24 字符（≈18 字节）提高，
 * 为覆盖 SVG 的文本判定：UTF-8 BOM（3 字节）+ 前置空白 + `<?xml`（5 字符）/`<svg`（4 字符）
 * 需在解码前缀内可见；36 字节仍**远小于整帧**。
 */
const IMAGE_ATTACH_METHOD = "image.attach_bytes";
const PDF_ATTACH_METHOD = "pdf.attach";
const ATTACHMENT_PREFIX_CHARS = 48;
const DATA_URL_BASE64_PREFIX = /^data:[^,]*;base64,/i;

/**
 * `_IMAGE_MAGIC`（`prompt_attachments.py:21-23`）：PNG / JPEG / GIF / BMP。
 * 补齐 TIFF / ICO / CUR（Hermes 允许 `.tiff/.tif/.ico`，但 `_IMAGE_MAGIC` 无对应条目）。
 */
const IMAGE_MAGIC: ReadonlyArray<Buffer> = [
  Buffer.from("89504e470d0a1a0a", "hex"),
  Buffer.from("ffd8ff", "hex"),
  Buffer.from("47494638", "hex"), // "GIF8"（覆盖 GIF87a / GIF89a）
  Buffer.from("424d", "hex"), // "BM"
  Buffer.from("49492a00", "hex"), // TIFF little-endian "II*\0"
  Buffer.from("4d4d002a", "hex"), // TIFF big-endian "MM\0*"
  Buffer.from("00000100", "hex"), // ICO
  Buffer.from("00000200", "hex"), // CUR
];
const PDF_MAGIC = Buffer.from("%PDF-", "latin1");

export type AttachmentValidation = { ok: true } | { ok: false; message: string };

/** 剥离可选 `data:...;base64,` 前缀与空白，只解码前 `ATTACHMENT_PREFIX_CHARS` 个字符。 */
function readBase64Prefix(raw: string): Buffer {
  let cleaned = raw.trim();
  const match = DATA_URL_BASE64_PREFIX.exec(cleaned);
  if (match) {
    cleaned = cleaned.slice(match[0].length);
  }
  return Buffer.from(cleaned.replace(/\s+/g, "").slice(0, ATTACHMENT_PREFIX_CHARS), "base64");
}

function matchesImageMagic(head: Buffer): boolean {
  for (const signature of IMAGE_MAGIC) {
    if (head.length >= signature.length && head.subarray(0, signature.length).equals(signature)) {
      return true;
    }
  }
  // WebP：`RIFF<4 字节尺寸>WEBP`（`prompt_attachments.py:69-70`）。
  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return true;
  }
  return matchesSvgMagic(head);
}

/**
 * SVG 为文本、无固定魔数：去 UTF-8 BOM 与前置空白后，前缀以 `<svg` 或 `<?xml` 开头
 * （大小写不敏感）。Hermes 允许 `.svg`（`cli_terminal_input.py:31-34`）但 `_IMAGE_MAGIC`
 * 无对应条目；此判定要求 `ATTACHMENT_PREFIX_CHARS` 足以覆盖 BOM + `<?xml`。
 */
function matchesSvgMagic(head: Buffer): boolean {
  const text = head.toString("utf8").replace(/^\uFEFF/, "").trimStart().toLowerCase();
  return text.startsWith("<svg") || text.startsWith("<?xml");
}

function readAttachmentPayload(params: Record<string, unknown>): string | null {
  for (const key of ["content_base64", "data"] as const) {
    const value = params[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return null;
}

/**
 * 校验上传载荷魔数（仅前缀解码）。
 * 非 `image.attach_bytes` / `pdf.attach`、无 base64 载荷（`path` 形态）或非 request → 放行。
 */
export function validateAttachmentMagic(
  frame: FrameClassification,
  parsed: unknown,
): AttachmentValidation {
  if (frame.kind !== "request" || !frame.method) {
    return { ok: true };
  }
  if (frame.method !== IMAGE_ATTACH_METHOD && frame.method !== PDF_ATTACH_METHOD) {
    return { ok: true };
  }
  if (!isRecord(parsed)) {
    return { ok: true };
  }
  const params = parsed.params;
  if (!isRecord(params)) {
    return { ok: true };
  }
  const payload = readAttachmentPayload(params);
  if (payload === null) {
    return { ok: true };
  }
  const head = readBase64Prefix(payload);
  if (frame.method === IMAGE_ATTACH_METHOD) {
    return matchesImageMagic(head)
      ? { ok: true }
      : { ok: false, message: "图片内容类型校验失败：魔数与允许的图片格式不符" };
  }
  if (head.length >= PDF_MAGIC.length && head.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return { ok: true };
  }
  return { ok: false, message: "PDF 内容类型校验失败：缺少 %PDF- 魔数" };
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
    if (user.role !== "super_admin") {
      // REQ-023：租户守卫通过后、转发前校验上传载荷前缀魔数。
      const attachment = validateAttachmentMagic(classification, parsed);
      if (!attachment.ok) {
        return {
          action: "reject",
          code: "INVALID_ATTACHMENT_TYPE",
          id: classification.id ?? null,
          message: attachment.message,
        };
      }
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
      if (user.role !== "super_admin") {
        // REQ-023：任一 attach 元素载荷魔数非法 → 整批拒绝。
        const attachment = validateAttachmentMagic(elementClassification, element);
        if (!attachment.ok) {
          return {
            action: "reject",
            code: "INVALID_ATTACHMENT_TYPE",
            id: elementClassification.id ?? null,
            message: attachment.message,
          };
        }
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

/** 上传内容类型不合法错误（REQ-023，同 `id`）。 */
export function invalidAttachmentFrame(id: number | string | null, message?: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code: 400,
      message: message ?? "上传内容类型不合法",
      data: { code: "INVALID_ATTACHMENT_TYPE" },
    },
  });
}
