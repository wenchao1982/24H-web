# Specification Draft: 对话页重构（openclaw 风格 hero + 会话控件）

> Spec ID: 003-composer-redesign | Phase: requirements-draft | Workflow: requirements-first | Version: v1.0.0-20260929-173000
> 状态：**待用户确认**（Gate 1 · BRAINSTORM CONFIRM 草稿）
> 生成时间：2026-09-29

## 0. 来源与澄清记录

**用户原话**：「对话框要重新做一下，新对话要类似 openclaw，且集成了模型切换、文件图片上传、智能体选择、工作区选择等，把功能重组一下 UI」

**已确认的 5 项澄清**：

1. **双态切换**：空会话显示居中 hero（大标识 + 标题 + pill 行 + 大输入框 + 最近会话）；有消息后输入框收拢到页面底部常驻（docked）。
2. **智能体 = Hermes profile，且服务端强制守卫**：选项来自 `/api/auth/me` 的 `profiles[]` 白名单；**BFF WS 代理补 profile 租户守卫**（非 `super_admin` 传未分配 profile → 403 `PROFILE_FORBIDDEN`，语义对齐 `apps/server/src/routes/hermes.ts:34-46`）。当前 `apps/server/src/hermes/proxy.ts:105-111` 只转发 `connection`，**无 profile 守卫** → 本次必闭合的安全缺口。
3. **控件布局（字段精简版）**：hero 行 3 pill = `智能体 · 工作区 · 模型`；输入框底行 = `＋ ｜ 权限模式 ｜（弹性空位）｜ 模型 ｜ 发送/停止`；`＋` 菜单 = 文件 / 图片 / PDF / 子代理 / 命令 / 上下文 / 人格 / 图片生成；会话头 `···` = 连接 / 导入 / 导出 / 分享 / 重命名；**明确不做**语音（`voice-live`）与 git 分支 pill。
4. **模型两级语义**：设置页 `POST /api/hermes/model/set` = 全局默认（不动）；对话页 pill = **本会话覆盖**。hero 态改"待创建会话的 `model` 参数"；会话内走 `config.set{key:"model", value, session_id, confirm_expensive_model}`。**只切模型**，`fast`/`reasoning` 不做切换，`Flash` 仅作只读徽标（来自 `model.options` 的 `capabilities.fast`）。
5. **上传全交互 + 延迟绑定**：点击选择（文件/图片/PDF）· 拖拽入框 · 粘贴图片（浏览器 Clipboard API）。hero 态点 `＋` **不建会话**，文件暂存前端（File + chip）；发送时按 `session.create` → `attach*` → `prompt.submit` 顺序执行。单文件上限 10MB。

**实现结构（已确认）**：方案 A — 单组件双态 + 控制器外提（`Composer` 加 `variant`，控件拆入 `chat/composer/`）。

**4 项 Ask First（已按推荐拍板）**：

| # | 问题 | 决定 |
|---|------|------|
| A1 | 会话内切「智能体」是否强开新会话 | **强开新会话**：已建会话的智能体 pill 只读展示，点击提示"切换将新建会话" |
| A2 | 单次上传数上限 / 拖拽文件夹 | **单次 ≤10 个**；拖拽文件夹**只取顶层文件，不递归** |
| A3 | `分享` 形态 | **沿用现有实现**（拼 `?session=<storedId>` 链接 + 剪贴板）搬入 `···` 菜单；导入/导出一并迁入 |
| A4 | WS 大 payload 降级策略 | 保持 **10MB、不分片**；>2MB 显示等待态；失败可重试且**复用已有 identity 不重复 create**；网关拒绝则原样透传其 message |

## 1. 业务背景

对话页是 24H Web 的核心工作台。当前问题：

- 空态只是一个图标 + 「新建会话」按钮，无首屏引导。
- 输入框（`apps/web/src/chat/Composer.tsx`）仅有附件 / slash / `@` 引用 / 发送，**没有模型选择器**——而 `requirement.md:26` 与 `ui-spec.md:23/31` 早已写明「模型就地切换」「模型在输入框」，代码从未实现（基线漂移）。
- 9 个功能按钮平铺在顶部工具栏（`ChatPage.tsx:786-862`），主次不分。
- 对话页**无法选择智能体（profile）**，`session.create` 传 `{}`（`ChatPage.tsx:390`）。
- 上传只能通过单个 file input；无拖拽、无粘贴。

本次目标：把对话页重做为 openclaw 式「双态 + 会话内控件」，并**同时闭合基线漂移与 WS 租户越权缺口**。

## 2. 用户故事

1. 作为**新用户**，我想打开对话页就看到居中的大输入框和最近会话，以便不走空页面、直接开始。
2. 作为**企业用户**，我想在输入框底行一键切换模型，以便不同任务用不同模型而不必去设置页。
3. 作为**企业用户**，我想拖拽或粘贴图片/文件进输入框，以便少点几步完成附件。
4. 作为**受限用户（admin）**，我希望即使我手动构造 WS 帧也无法访问未分配的 profile，以便租户边界可信。
5. 作为**管理员**，我希望会话内切模型在回合运行中被安全延后到下一回合，以便不打断生成。
6. 作为**成本敏感用户**，我希望选昂贵模型时被二次确认，以便避免意外计费。
7. 作为**多项目用户**，我想为会话显式指定工作目录，以便新会话使用我选的项目目录而非继承全局值。
8. 作为**键盘用户**，我希望用键盘完成选文件、切模型、关闭菜单，以便不依赖鼠标。

## 3. 功能需求（GEARS 统一语法）

> 语法：`[Where <静态前置>] [While <状态前置>] [When <触发>] The <主体> shall <响应>`

| ID | 优先级 | Where（静态前置） | While（状态前置） | When（触发） | Subject（主体） | Response（shall） | 验收标准（GWT） |
|----|--------|------------------|------------------|-------------|---------------|------------------|-----------------|
| REQ-001 | high | 对话页已挂载（已认证） | 会话 `items.length === 0` 且无活动会话 | 渲染 / 追加首条消息 | 对话页 | shall 渲染**居中 hero**（大标识 + 标题 + pill 行 + 大输入框 + 最近会话）；有消息时输入区切为 **docked 贴底常驻**，hero 移除 | Given 已登录且无活动会话, When 进入对话页, Then `.chat-hero` 存在且含大输入框与「最近会话」区; Given 已有 `items`, When 追加首条消息, Then hero 移除、输入区贴底常驻 |
| REQ-002 | high | 对话页已挂载 | hero 态 | hero 渲染 | 输入区 | shall 在 pill 行渲染 `智能体 · 工作区 · 模型` 三个控件，**智能体选项仅取 `/api/auth/me` 的 `profiles[]`** | Given `me.profiles = ["p1","p2"]`, When hero 渲染, Then 智能体 pill 选项恰为 `{p1,p2}` 且**不含** `profiles.list` 的全量值 |
| REQ-003 | high | 对话页已挂载 | 任意态 | 输入区渲染 | 输入区 | shall 在底行渲染 `＋ ｜ 权限模式 ｜（弹性空位）｜ 模型 ｜ 发送/停止`，且 **不**渲染语音与 git 分支 pill | Given 输入区渲染, When 查询 DOM, Then 底行控件集合精确匹配; 断言 `voice-live` 与 branch pill **不存在** |
| REQ-004 | medium | 存在活动会话 | 用户点击会话头 `···` | 会话头菜单 | shall 提供 `连接 / 导入 / 导出 / 分享 / 重命名` 五项 | Given 有活动会话, When 点 `···`, Then 菜单恰含 5 项; `重命名` 走 `session.title{runtimeId}`; `分享` 沿用 `?session=<storedId>` + 剪贴板 |
| REQ-005 | high | 对话页已挂载 | 输入区可见 | 点击 `＋` 选文件/图片/PDF、或拖拽入框、或粘贴图片 | 上传模块 | shall 生成前端 chip 暂存（File 对象），**hero 态不得触发任何 RPC** | Given hero 态, When `＋→图片` 选 1 图, Then 出现 1 chip 且 `gateway.request` **调用数为 0**; Given 拖拽 3 文件, When drop, Then 3 chip 且无 RPC; Given 粘贴含图片的 `ClipboardEvent`, Then 走**浏览器 Clipboard API**（**非** `clipboard.paste` / `input.detect_drop`） |
| REQ-006 | high | 对话页已挂载 | 有待发送文本或 chip | 用户发送且当前无活动会话 | 发送流程 | shall 严格按 `session.create` → `attach*`（逐附件）→ `prompt.submit` 顺序执行；任一失败中止后续并透传网关真实 message | Given hero + 文本 + 2 附件, When 发送, Then 调用序为 `session.create` → `file.attach`/`image.attach_bytes`/`pdf.attach`（逐条，runtime id）→ `prompt.submit`; Given 第 1 个 attach 报错, Then **不调用** `prompt.submit` 且展示网关 message |
| REQ-007 | medium | 对话页已挂载 | 用户选择文件 | 单文件 `size > 10MB` | 上传模块 | shall 拒绝该文件并给含文件名与上限的可读错误，不影响其余合法文件 | Given 选择 12MB 文件, When 校验, Then 该 chip 被拒 + 错误含「10MB」; 同一批的 1MB 文件仍入 chip |
| **REQ-008** | **critical** | BFF WS 代理路径已建立 | 角色非 `super_admin` | WS 帧 `params.profile` 指向未分配 profile | **BFF WS 代理** | shall 以同 `id` 回 `403 PROFILE_FORBIDDEN` 且**不转发**该帧到 Hermes（语义对齐 `hermes.ts:34-46`） | Given `admin` 未分配 `px`, When WS 发 `{method:"session.create", params:{profile:"px"}}`, Then 收到同 `id` 的 403 且上游未收到该帧; Given `super_admin`, Then 帧正常转发 |
| REQ-009 | high | 对话页已挂载 | hero 态（无 session） | 用户切换模型 pill | 模型控件 | shall **仅更新待创建会话的 `model` 参数**（不发 `config.set`）；会话内则发 `config.set{key:"model", value, session_id: runtimeId}` | Given hero + 选 `m-b`, When 发送, Then `session.create` 入参含 `model:"m-b"` 且 `config.set` 调用数为 0; Given 会话内 `runtimeId = R`, When 选 `m-b`, Then `config.set{key:"model", value:"m-b", session_id:R}` |
| REQ-010 | high | 会话运行中 | `running === true` | 用户切换模型 | 模型控件 | shall 接受选择并显示为目标模型；网关回包 `deferred:true` 时提示「将于下一回合生效」，**不得**在回合中途热切 | Given 回合运行中, When 切模型, Then UI 目标为新模型且出现「下一回合生效」提示; 最终与 `session.info.display_model` 一致 |
| REQ-011 | high | 会话已建立 | 该模型被 `model.options` 标为昂贵 | 用户选定昂贵模型 | 模型控件 | shall 走 `config.set{confirm_expensive_model:true}`；回 `confirm_required:true` 时须**二次确认后**才重发 | Given 昂贵模型, When 选择, Then 首次返回 `confirm_required` 不落库并弹确认; When 确认, Then 带 `confirm_expensive_model:true` 重发生效 |
| REQ-012 | high | 对话页已挂载 | 用户在工作区 pill 选择目录 | 选择动作 | 工作区控件 | hero 态 shall 写入 `session.create` 的 `cwd` **且 `cwd_explicit:true`**；会话内 shall 用 **stored id** 发 `session.workspace.move{session_key, cwd}` | Given hero + 选 `/w/a`, When 发送, Then `session.create` 含 `cwd:"/w/a", cwd_explicit:true`; Given 会话内 + 选 `/w/b`, Then `session.workspace.move{session_key: storedId, cwd:"/w/b"}`（断言**非** runtimeId） |
| REQ-013 | medium | 会话已建立 | 用户切换权限模式 | 选择非默认模式 | 权限控件 | shall 发 `config.set{key:"yolo", scope:"session"}`，且失败时**回滚 UI 选中态** | Given 会话内, When 选「自动批准」, Then `config.set{key:"yolo", scope:"session"}`; 回包错误, Then 选中态回滚并展示 message |
| REQ-014 | medium | 对话页已挂载 | `identity.storedId !== activeId`（身份未就绪） | 渲染 / 交互 | 运行中 RPC 守卫 | shall 禁用会话域控件并阻止 runtime-id RPC 发出 | Given 点选非活动行触发 resume 中, When 用户点发送, Then RPC 被本地拦截且 `prompt.submit` 未发出 |

## 4. GEARS → GWT 映射

| REQ ID | Given（Where + While） | When | Then |
|--------|-----------------------|------|------|
| REQ-001 | 对话页 + 无消息 | 进入 / 首条消息 | hero 或 docked 结构断言 |
| REQ-002 | 对话页 + hero | 渲染 | pill 选项 = `me.profiles` |
| REQ-003 | 对话页 + 任意态 | 渲染 | 底行控件集合精确匹配 |
| REQ-004 | 有活动会话 | 点 `···` | 5 项菜单 |
| REQ-005 | 输入区可见 | 点击 / 拖拽 / 粘贴 | chip 生成、零 RPC |
| REQ-006 | hero + chip | 发送 | create → attach* → submit 有序 |
| REQ-007 | 已选文件 | > 10MB | 拒绝 + 可读错误 |
| REQ-008 | 非 super_admin | WS `params.profile` 越权 | 403 PROFILE_FORBIDDEN 且不转发 |
| REQ-009 | hero / 会话内 | 切模型 | create 参数 / `config.set` |
| REQ-010 | 回合运行中 | 切模型 | `deferred` 提示 |
| REQ-011 | 昂贵模型 | 选定 | `confirm_expensive_model` 二次确认 |
| REQ-012 | hero / 会话内 | 选工作区 | `cwd_explicit:true` / `workspace.move`（stored） |
| REQ-013 | 会话内 | 切权限模式 | `config.set yolo scope:"session"` |
| REQ-014 | resume 进行中 | 触发 RPC | 本地拦截 |

## 5. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | hero 首帧无额外网络请求；选项加载（`model.options` / workspaces / `me`）可并行且每会话 ≤ 1 次；chip 渲染 P95 < 16ms；10MB 文件 base64 编码不得阻塞主线程 > 50ms（异步 `FileReader`） |
| 可访问性 | 所有 pill / 菜单 / 上传入口有 `aria-label`；菜单 `role="menu"` + `Esc` 关闭 + focus 归还触发元素；拖拽区 `aria-describedby`；错误用 `role="alert"`；键盘可完成「选文件（`＋` → Enter）」全链路 |
| 一致性 | 仅用 `--ds-*` token；0.5px 发丝描边；圆角走 `corner-shape` 超椭圆回退；中文文案；不引 UI 库 |
| 可测性 | 选择/状态逻辑下沉为**纯函数 / reducer**（`useSessionControls`、`pendingAttachments`、normalizers），组件仅做渲染 |
| 安全 | 前端零 token；文件字节与 base64 **绝不进日志**；WS 守卫复用服务端 `assertProfileAccess` 语义 |
| 兼容 | React 19 `StrictMode` 双调用下 hero↔docked 与上传流程**幂等** |

## 6. 属性测试属性

| REQ | Property | Invariant | Edge Cases |
|-----|----------|-----------|------------|
| REQ-001 | hero 显示 ⟺ `items.length === 0` | hero 与 docked 互斥且必居其一 | empty、单条、切会话中间态、StrictMode 双渲染 |
| REQ-002 | pill 选项集合恒等于 `me.profiles` 白名单 | 不回退到全量列表 | null / 缺字段、空数组、重复项 |
| REQ-003 | 底行控件集合为常量 | 永不含 voice / git | 窄屏、侧栏折叠、运行中（发送↔停止） |
| REQ-004 | 菜单项集合恒为 5 项 | 重命名恒用 runtimeId | 无活动会话时菜单不渲染 |
| REQ-005 | 确认发送前 RPC 调用数恒为 0 | 延迟绑定不可被绕过 | 0 文件、批量、同名、粘贴无图片项 |
| REQ-006 | 成功发送的调用序恒满足 `create ≺ attach* ≺ submit` | attach 全成功才 submit | attach 部分失败、create 失败、chip 为空、并发双击发送 |
| REQ-007 | 入 chip 者恒 `size ≤ 10MB` | 上限不可绕过 | 恰好 10MB、10MB+1B、0 字节、超限混入合法 |
| REQ-008 | 放行 ⟺ `super_admin ∨ assigned` | 守卫与 REST 同语义 | profile 缺失、空串、super_admin、多 profile |
| REQ-009 | hero 路径恒不产生 `config.set`；会话路径恒带 `session_id = runtimeId` | 两级语义不混用 | 无 session、身份未就绪、连续切换 |
| REQ-010 | `running=true` 时切换恒不热切，最终目标 = 用户选择 | `display_model` 与 UI 一致 | deferred 后又被覆盖、turn start 丢弃 stash、interrupt 后切换 |
| REQ-011 | 未确认昂贵模型恒不生效 | 确认后方可落库 | `confirm_required` 后取消、连续两次选昂贵 |
| REQ-012 | hero 恒 `cwd_explicit:true`；会话内恒 `session_key = storedId` | 身份键不可互换 | 空 cwd、相对路径、切会话后沿用旧 cwd |
| REQ-013 | 权限变更失败时 UI 选中态 = 变更前 | 无乐观残留 | 回包 error、scope 缺省、连续切换 |
| REQ-014 | 若 `storedId !== activeId` 则 0 条 runtime-id RPC 外发 | 本地守卫强于网关 | resume 中、resume 失败、快速切行 |

## 7. 边界（Always / Ask First / Never）

| 级别 | 边界 | 规则 |
|------|------|------|
| ✅ Always | 会话域 RPC 前校验 `identity.storedId === activeId` | 身份未就绪一律不发 runtime-id RPC（REQ-014） |
| ✅ Always | `workspace.move` 用 stored id；`title` / `interrupt` / `attach*` / `config.set` 用 runtime id | 身份键成对使用，归一化失败即报错 |
| ✅ Always | 上游/网关错误 message 原样透传 | 不吞错、不替换为泛化文案（REQ-006） |
| ✅ Always | 上传经浏览器 API（File / Clipboard / DnD） | `clipboard.paste` / `input.detect_drop` 是宿主侧，禁用 |
| ✅ Always | 仅用 `--ds-*` token 手写 CSS | 不引 UI 库 |
| ❓ Ask First | 单次上传数上限 / 拖拽文件夹 | 已定：≤10 个、不递归（A2） |
| ❓ Ask First | `分享` 目标形态 | 已定：沿用现有链接 + 剪贴板（A3） |
| ❓ Ask First | 会话内切智能体 | 已定：强开新会话（A1） |
| ❓ Ask First | WS 大 payload 降级 | 已定：10MB 不分片、>2MB 等待态（A4） |
| 🚫 Never | 前端持有 Hermes token 或回显密钥 | 红线（`AGENTS.md §8`） |
| 🚫 Never | 把文件字节 / base64 写入日志 | 红线 |
| 🚫 Never | hero 态因上传而调用 `session.create` 等 RPC | 破坏延迟绑定（REQ-005） |
| 🚫 Never | 回合运行中强行热切模型（绕过 `pending_model_switch`） | 破坏网关契约（REQ-010） |
| 🚫 Never | 在 WS 代理路径跳过 profile 守卫 | 安全缺口（REQ-008，critical） |

## 8. 契约依据（官方源码，供设计阶段复核）

源码根：`/vol1/@apphome/trim.openclaw/data/home/hermes-desktop/home/hermes-agent/tui_gateway/`

| 事实 | 依据 |
|------|------|
| `ProfileParams{profile?}` / `SessionParams{session_id, profile?}` | `contracts/common.py:221-231` |
| `SessionCreateParams(ProfileParams)` 含 `cwd` / `cwd_explicit` / `model` / `provider` / `reasoning_effort` / `fast` / `title` | `contracts/sessions.py:118-147` |
| `session.resume` 入参 = stored id，回包 `session_id` = runtime id | `contracts/sessions.py:174-191` |
| `session.workspace.move{session_key(stored), cwd}` / `session.cwd.set{session_id(runtime), cwd}` | `contracts/sessions.py:326-349` |
| `ConfigSetParams{key, value, session_id?, scope?, confirm_expensive_model}` | `contracts/config_free_tier_control.py:74-107` |
| 运行中模型切换改为 stash 到下一回合，回 `deferred:true` | `methods_config_set.py:73-91` |
| `model.options{session_id?, ...}` → `{providers[], model, provider}`，含 `capabilities{fast, reasoning}` | `contracts/config_free_tier_control.py:216-280` |
| `image.attach{path}`（host path）vs `image.attach_bytes{content_base64}` | `contracts/prompt_voice.py:112-135` |
| `file.attach{path?|data_url?|name?}` → `{ref_path, ref_text, uploaded}` | `contracts/prompt_voice.py:164-183` |
| `pdf.attach{path?|content_base64?|data_filename?}` → 渲染 PNG 页 | `contracts/prompt_voice.py:134-161` |
| `clipboard.paste{}` = **宿主**剪贴板（浏览器不可用） | `contracts/prompt_voice.py:104-109` |
| `input.detect_drop{text}` = 仅识别**终端**拖拽文本（浏览器不可用） | `contracts/prompt_voice.py:199-215` |

## 9. 风险与未决

| # | 风险 | 影响 | 缓解 |
|---|------|------|------|
| R1 | 运行中切模型的 `deferred` 与用户预期差（未确认 stash 还可能在 turn start 被丢弃） | 困惑、误报 bug | UI pending 态 + 「下一回合生效」文案；以 `session.info.display_model` 为准对齐；属性测试覆盖「切换后又被覆盖」 |
| R2 | `cwd_explicit` 与具名 profile `terminal.cwd` 的优先级 | 会话跑错目录 | 仅在 hero 显式选目录时置 `cwd_explicit:true`；未选时**省略该字段**（不传 `false`）；单测断言两种入参 |
| R3 | base64 经 WS 的体积/超时（10MB → ≈13.3MB 单帧） | 上传失败、连接断开 | 已定 A4：不分片、>2MB 等待态、失败重试复用 identity；网关拒绝原样透传 |
| R4 | WS profile 守卫可能误伤既有 `profiles.list` 调用 | 智能体页回归 | 守卫仅在帧 `params.profile` 存在且非 `super_admin` 且未分配时拦截；专项回归测试 |
| R5 | 会话内切 profile 导致上下文/工作区语义混乱 | 数据串会话 | 已定 A1：强开新会话 |
| R6 | 拖拽/粘贴与 slash / `@` 菜单焦点冲突 | 键盘不可达 | 统一 focus 管理与 Esc 冒泡策略 |
| R7 | 基线漂移（`requirement.md` / `ui-spec.md` 与 `docs/TASKS.md:102` 矛盾） | 后续任务反复 | Wave 0 先改 4 份基线 + `task-list.md`，收口复核 |

## 10. 基线同步要求（红线 `AGENTS.md §11`）

变更须先改 4 份基线文档，再更新 `task-list.md`，最后才改代码：

- `AGENTS.md`：§5 补 WS profile 守卫；§4 明确「智能体 = Hermes profile」
- `requirement.md`：§3 对话改为双态 + 字段精简版控件
- `ui-spec.md`：§3 对话补 hero / docked / 3 pill / 底行；订正 §1 与「模型就地切换」的一致性
- `architecture.md`：§6 补 WS 守卫与两级模型语义
- `docs/TASKS.md`：订正 T8.2「落点：设置」矛盾项
- `task-list.md`：更新唯一「下一步」入口

---

**草稿结束。此文件待用户确认后作为 `requirements.md` 的基线。**
