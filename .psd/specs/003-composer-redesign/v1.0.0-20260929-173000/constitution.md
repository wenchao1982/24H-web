# Project Constitution — Spec 003 对话页重构

> 本文件是 003-composer-redesign 的**项目级约束**：技术约束（GEARS 格式）、流程规则、三级边界。
> 与 `requirements.md` §7 边界表一致；冲突时以本文件为准。

## 1. 技术约束（GEARS 格式）

| ID | GEARS 约束 |
|----|-----------|
| TC-001 | Where 项目为 TypeScript monorepo（`apps/web` + `apps/server` + `packages/shared`），The 实现 shall 保持 **strict** 类型（ESM），不得引入 `any` 逃逸 |
| TC-002 | The 前端 shall **不引入任何 UI 库**；所有样式 shall 手写 CSS 并仅引用 `--ds-*` design token（`apps/web/src/styles.css`） |
| TC-003 | The 圆角 shall 使用 `--ds-radius-*`（`--ds-radius-sm/md/lg/pill`）；**禁止**依赖 `corner-shape` 超椭圆（代码库中不存在该实现） |
| TC-004 | The 上级颜色 shall 只出现于 token 定义处；其余规则不得出现硬编码色值 |
| TC-005 | The BFF shall 构建为 esbuild 单文件 ESM bundle（`apps/server/dist/server.mjs`，`packages: external`），原生依赖 `better-sqlite3` / `@node-rs/argon2` 保持 external |
| TC-006 | The 应用根 shall 通过 `apps/server/src/paths.ts#findRepoRoot` 解析；**禁止**用相对 `import.meta.url` 层级硬算 |
| TC-007 | The 验证命令 shall 固定为 `npm run check`（typecheck web+server+shared + vitest）；e2e shall 单独跑 `npm run test:e2e` 且不进 `check` |
| TC-008 | Where 浏览器 SPA，The 前端 shall **不持有** Hermes token，只持 BFF 会话 cookie（`24h_session`）+ CSRF（`24h_csrf` → `x-csrf-token`） |
| TC-009 | The 密钥与口令 shall 不落前端、不落日志（env 只回键名） |
| TC-010 | The SQL shall 参数化（better-sqlite3 prepared statements） |
| TC-011 | The 子进程 shall 使用 `shell:false` + 参数数组，禁止 shell 注入 |
| TC-012 | The 错误结构 shall 统一为 `{ error, message }`（REST）与 `{jsonrpc, id, error:{code, message, data?}}`（WS） |
| TC-013 | The 新能力 shall 优先落在现有层（BFF 路由 / SPA 页面 / `chat/composer/`），**不得**新造框架或 UI 库 |
| TC-014 | Where 涉及 Hermes 契约，The 实现 shall 以官方生成文件 / 契约源码为准（`tui_gateway/contracts/*.py`），**禁止**猜测 Hermes 内部 schema |
| TC-015 | The 文案 shall 为中文；新增 i18n key shall 先在 `apps/web/src/i18n/zh.ts` 注册（类型约束） |
| TC-016 | Where 涉及 Hermes 契约的判定（`maxPayload` / notification 是否执行 / `model.options` 结构 / `pricing` 语义），The Spec shall 把可核验的契约片段归档到 `.psd/specs/003-composer-redesign/<version>/contracts-evidence.md`，**不得**仅以仓库外路径作为唯一依据 |
| TC-017 | The BFF WS 代理 shall 显式设定 `maxPayload` 与 `pending`/`outbound` 队列长度上限，**不得**依赖 `ws` 库默认值 |
| TC-018 | The WS 队列上限 shall 同时约束**条数**与**累计字节**（`pendingBytes ≤ K × maxPayload`）；`maxPayload` 须同时作用于客户端接入侧与上游侧 socket |
| TC-019 | WS 租户守卫的**豁免判据** shall 为「参数类 schema 未声明 `profile` 字段」（从官方契约派生，**不得**以「是否直继 `Params`」判断），并归档到 `contracts-evidence.md`；`maxPayload` shall 为 `16 MiB`、`K` shall 为 `4`（累计 ≤ 64 MiB）。且 Wave 1 的 WS 代理 shall 显式设 `maxPayload` 并作用于双 socket |

## 2. 流程规则（红线）

| ID | 规则 |
|----|------|
| PR-001 | **变更先改基线**：任何代码改动前，shall 先更新 4 份基线文档（`AGENTS.md` / `requirement.md` / `ui-spec.md` / `architecture.md`），再更新 `task-list.md`，最后才改代码（`AGENTS.md §11.1`） |
| PR-002 | **禁 Vibe**：正式开发 shall 走 Spec 模式；应急走 Build 后须补回基线文档 |
| PR-003 | **任务顺序执行**：前置任务未验收，shall 不得开启后继任务 |
| PR-004 | **质量门前置**：`npm run check` 未全绿，shall 不得进入人工验收 |
| PR-005 | **会话节奏**：每 3–5 个任务 shall 重置会话，避免上下文污染 |
| PR-006 | **身份键成对使用**：`session.resume` 入参用 stored id；会话域 RPC（`prompt.submit` / `session.interrupt` / `session.title` / `attach*` / `config.set(session_id)` / `subagent.*`）用 **runtime id**；`session.delete` / `session.workspace.move(session_key)` 用 **stored id** |
| PR-007 | **归一化失败即报错**：`runtimeId` 仅来自 `resume`/`create` 回包；缺失 `session_id` shall 报错，**禁止**回退 stored id |
| PR-008 | **错误透传**：上游/网关错误 message shall 原样透传，**禁止**吞错或替换为泛化文案 |
| PR-009 | **原子写入**：Spec artifact shall 全有或全无；任一写入失败须清理部分写入 |
| PR-010 | **每 3–5 任务复位**：见 PR-005；`CONTRIBUTING.md §5` 为准 |
| PR-011 | **安全项同波次**：租户边界的守卫与其响应过滤（REQ-008 / REQ-015 / REQ-017 / REQ-018）shall 在同一波次交付，**不得**把已识别的安全缺口中途挂在后续波次 |
| PR-012 | **禁止代写评审结论**：`manifest.json` 的 `reviewResult` 只能由评审结果写入；任何代理**不得**预先填入 `verdict` / `status: approved-for-build`。在对抗性评审返回 DEFEND 之前，`status` shall 为 `draft` / `in-review` |
| PR-013 | **审计要求**：租户守卫拒绝（WS 403 / REST 403）与响应过滤 fail-closed shall 写 `audit`（`apps/server/src/audit/repo.ts`），便于发现越权探测 |
| PR-014 | **契约同步**：凡由契约派生的清单（豁免清单 / 方法分类）shall 与归档的 `contracts-evidence.md` 同版本；契约变更时 shall 同步清单并重跑 MethodSweep |

## 3. 边界（Always / Ask First / Never）

### ✅ Always Do

| ID | 边界 |
|----|------|
| A-001 | 会话域 RPC 前校验 `identityReady`（`activeId !== null` 且 `identity.storedId === activeId`） |
| A-002 | 上传只经浏览器 API（`File` / `ClipboardEvent` / `DataTransfer`），**并用** `image.attach_bytes` / `file.attach{data_url}` / `pdf.attach{content_base64}` |
| A-003 | 拖拽之外提供可聚焦的文件选择按钮（WCAG 2.5.7） |
| A-004 | 菜单符合 APG Menu Button（`aria-haspopup` / `aria-expanded` / `role="menuitem"` / `Esc` + 焦点归还） |
| A-005 | 隐藏的 file input 用 visually-hidden（`clip-path: inset(50%)`），不用 `display:none` |
| A-006 | WS 守卫 **default-deny**：凡解析后含 `method` 字符串的帧一律按 request 施加守卫（**不论**是否有 `id`、**不论**是否带 `result`/`error`）；JSON 数组批帧逐元素分类与守卫；**二进制帧与 JSON 解析失败一律拒绝** | 见 N-013 |
| A-006b | 非 `super_admin` 的 request 帧缺失 `params.profile` 时：**参数类 schema 未声明 `profile` 字段**的方法 shall 豁免（不得注入，否则 `extra="forbid"` → 4000）；**其余一切方法（含清单外的未知方法）** shall 注入 `default_profile`；无可用则 403。**判据唯一 = schema 是否声明 `profile`**（禁止人工枚举、禁止「是否直继 `Params`」） | REQ-017 |
| A-006f | REST `/api/hermes/*` 缺 `profile` 时：命中豁免路径（`/api/hermes/health`）则放行；**其余路径**注入 `default_profile` 或 403。**禁止**在缺 `profile` 时提前 `return` | REQ-022 |
| A-006g | 豁免判据 shall 为**参数类 schema 是否声明 `profile` 字段**，并从官方契约派生（归档 `contracts-evidence.md`）；**禁止**人工枚举后长期不校验，**禁止**以「是否直继 `Params`」为判据 | TC-019 |
| A-006d | 队列上限须同时约束**条数**与**累计字节** | REQ-018 |
| A-006e | 守卫拒绝与响应过滤 fail-closed 必写 `audit` 记录（actor / profile / method / ip / 结果；不含 token / 密钥 / 文件字节） | REQ-021 |
| A-006c | 响应侧过滤（`profiles.list`）：**「成功但结构不符」才 fail-closed**；上游**错误帧（`{id,error}`）必须原样透传** | REQ-015 |
| A-007 | 错误提示用 `role="alert"`（即时）或 `role="status"` + `aria-live="polite"`（累积） |
| A-008 | `previewUrl`（`URL.createObjectURL`）在移除 / 清空 / 发送成功 / 卸载 4 个时机恰好 revoke 一次 |
| A-009 | 上传内容类型 shall 由**服务端**校验：BFF WS 代理对 `image.attach_bytes` / `pdf.attach` 的 `content_base64`/`data` 载荷做**前缀 magic bytes** 校验（仅解码前 48 个 base64 字符 ≈36 字节，禁止整帧解码；可判定格式含 PNG/JPEG/GIF/BMP/WebP/TIFF/ICO/CUR 与 SVG 文本前缀）；不匹配 shall 以同 `id` 回 `INVALID_ATTACHMENT_TYPE`、**不转发**并写 `audit`；`file.attach` 不限类型 | REQ-023 / R10 |

### ❓ Ask First

| ID | 边界 | 当前决定 |
|----|------|---------|
| Q-001 | 单次上传文件数上限 / 拖拽文件夹 | 已定：单次 ≤10 个；只取顶层文件，不递归 |
| Q-002 | `分享` 目标形态 | 已定：沿用现有 `?session=<storedId>` 链接 + 剪贴板 |
| Q-003 | 会话内切换智能体（profile） | 已定：**强开新会话**；已建会话的 pill 只读展示 |
| Q-004 | WS 大 payload 降级策略 | 已定：保持 10MB、不分片；>2MB 显示等待态；失败重试复用 identity 不重复 create；网关拒绝原样透传 |
| Q-005 | 服务端 magic bytes 校验落点（Hermes 还是 BFF） | **已定：BFF（REQ-023 / TASK-037，2026-09-30）**。Hermes 仅 `_sniff_image_ext` **推断扩展名、不做内容类型拒绝**（实测非图片字节被接受），PDF `%PDF-` 校验被 `pdftoppm` 依赖遮蔽（缺 poppler-utils 回 5028）；`methods_profiles.py:16` 仅表示不信任声明的 MIME。**落地**：BFF WS 代理对 `image.attach_bytes`/`pdf.attach` 的 base64 载荷做**前缀**魔数校验，不匹配同 `id` 回 `INVALID_ATTACHMENT_TYPE` + `audit` + 不转发；`file.attach` 不限类型（R10 闭合） |
| Q-006 | `···` 菜单「连接」的确切语义（多实例切换 vs 状态展示） | **未定**，需产品确认 |
| Q-007 | `/api/auth/me` 是否返回头像（决定 AgentPicker 是否只用首字占位） | **未定**，实现阶段验证 |
| Q-008 | 官方 L1 是否支持 JSON-RPC 数组批帧 | **未定**，实现阶段验证 |
| Q-009 | hero 态选昂贵模型无二次确认（`session.create` 无 `confirm_expensive_model` 字段） | **已定**：接受该限制（REQ-011a）；网关若拒绝则透传 message |
| Q-010 | WS 豁免清单（判据 = 参数类未声明 `profile`）与 REST 豁免清单（1 条）是否与官方契约/路由完全一致 | **已定（MethodSweep 机械核验 2026-09-30）**：WS 26 条 == 注册表无 `profile` 字段方法集合（原 18 条补齐 8 条，无「多出」）；结果见 `contracts-evidence.md §4.3`；漏判方向为功能回归 |
| Q-011 | `_SessionScoped` 方法（`tools.list`/`toolsets.list`/`tools.show`）无 `profile` 字段可注入，缺 `session_id` 时回退启动 profile 配置 | **已定（TASK-036，2026-09-30）**：缺 `session_id` fail-closed 拒绝；带 `session_id` 按 per-connection `sessionOwners` 校验归属（未知/他人 403 不转发） |

### 🚫 Never Do

| ID | 边界 |
|----|------|
| N-001 | 前端持有 Hermes token 或回显密钥（`AGENTS.md §8`） |
| N-002 | 把文件字节 / base64 写入日志、或写入 DOM 文本 |
| N-003 | hero 态因上传而调用 `session.create` 等任何 RPC（破坏延迟绑定） |
| N-004 | 回合运行中强行热切模型（绕过网关 `pending_model_switch`） |
| N-005 | 在 WS 代理路径跳过 profile 守卫 |
| N-006 | 在 WS 守卫中拦截含 `result`/`error` 的**响应帧**（会打断审批/secret/sudo 回包） |
| N-007 | 用 `image.attach{path}` 传浏览器本地文件（浏览器无网关可见路径） |
| N-008 | 使用 `clipboard.paste` / `input.detect_drop` 实现浏览器粘贴与拖拽（二者作用于**宿主**侧） |
| N-009 | 在 JSX 中条件渲染两个不同的 Composer 组件（会卸载并丢失 draft/chip） |
| N-010 | 用前端白名单（`me.profiles`）充当安全边界 |
| N-011 | 修改 `apps/web/src/settings/model.ts#normalizeModelOptions`（会牵动已验收的 T8.2 与 `ModelPanel`） |
| N-012 | 重命名既有 aria-label（`消息` / `发送` / `停止` / `添加附件` / `移除引用`）或既有 class 名（测试依赖） |
| N-013 | 以「缺少 `id`」或「存在 `result`/`error`」为由，把含 `method` 的帧按「通知/响应」放行（CRITICAL 绕过路径） |
| N-014 | 透传二进制帧或无法解析的帧而不拒绝 |
| N-015 | 在 `activeId === null`（hero 态）禁用发送（会破坏 REQ-001/REQ-006） |
| N-016 | 由前端预判「昂贵模型」并据此弹确认（判据必须以网关 `confirm_required` 回包为准） |
| N-017 | 在响应过滤失败时透传未过滤的全量（必须 fail-closed） |
| N-018 | 用「包含式前缀白名单」（如仅 `session.`/`profiles.`/`mcp.`/`skills.`）决定是否注入租户上下文 —— 遗漏即 fail-open |
| N-019 | 把上游错误帧替换为 BFF 自造错误（违反 PR-008） |
| N-020 | 以 `session.info` 作为模型对齐来源（该 RPC 不存在） |
| N-021 | 把「清单外的方法/路径」当作豁免（未知即放行）——未知 must 按需 profile 处理 |
| N-022 | REST `/api/hermes/*` 在缺 `profile` 时提前 `return` 跳过 `assertProfileAccess`（`routes/hermes.ts:40` 的现状） |
| N-023 | 向参数类 schema 未声明 `profile` 的方法注入 `profile`（`extra="forbid"` → 4000，功能回归） |
| N-024 | 以「是否直继 `Params`」作为豁免判据（判据与契约事实相反） |
| N-025 | 仅依赖客户端声明的 `File.type`/MIME 作为上传内容类型的安全边界（客户端可伪造） |
| N-026 | 为校验上传魔数而**整帧 base64 解码**载荷（10MB → ≈13.3MB，内存放大）——只可解码前缀 |
