# Tasks: 对话页重构（hero/docked + 会话控件 + WS 租户守卫）

> Spec ID: 003-composer-redesign | Phase: tasks | Version: v1.0.0-20260929-173000
> 依据：`requirements.md`（**26 条 REQ 条目**：REQ-001..022 + 后缀 010a / 011a / 018a / 018b）+ `design.md`
> 验证命令固定 `npm run check`；e2e 独立 `npm run test:e2e`

## 前置红线

`AGENTS.md §11`：**必须先在 Wave 0 改完 4 份基线文档 + `task-list.md`，才能动代码**。任务顺序执行，前置未验收不得开启后继。

---

## Wave 0 — 基线文档（阻塞全部后续）

| ID | 描述 | REQ Link | 优先级 | 依赖 | 验证方式 |
|----|------|----------|--------|------|----------|
| TASK-001 | 订正 4 份基线：`AGENTS.md`（§4 智能体=profile / §5 WS 租户守卫 / §9 目录表新增 `chat/composer/`）、`requirement.md`（§3 对话改双态+精简控件+本会话模型覆盖+上传三通道）、`ui-spec.md`（§1/§2/§3 hero/docked/3 pill/底行/`···`菜单；**删除不存在的「corner-shape 超椭圆」**改 `--ds-radius-*`）、`architecture.md`（新增「两级模型语义 + WS 租户守卫 + 10MB 规范偏差与补偿控制」） | REQ-001..016（基线） | high | — | 人工评审 diff；关键词 grep（`hero` / `WS 租户守卫` / `两级模型` / `--ds-radius` 命中，`corner-shape` 零命中） |
| TASK-002 | 订正 `docs/TASKS.md`：`T8.2`（落点：设置=全局默认；对话页=本会话覆盖，走 L1 `config.set`/`model.options`）、`T4.4`（补 profile 守卫）、`T6.11`（明确延迟绑定 + `attach_bytes`）；更新 `task-list.md`（订正 `T8.2`/`T4.4` 描述 + 新增 M17 段作为唯一「下一步」入口） | REQ-009, REQ-008 | high | TASK-001 | `rg "T8.2\|T4.4"` 前后语义一致；M17 段存在 |

## Wave 1 — 安全守卫 + 纯函数层（**安全同波次**，相互独立，可并行）

> **PR-011**：REQ-008 / REQ-015 / REQ-017 / REQ-018 必须在本波次一次交付，不得跨波次。

| ID | 描述 | REQ Link | 优先级 | 依赖 | 验证方式 |
|----|------|----------|--------|------|----------|
| TASK-003 | `apps/server/src/hermes/proxy.ts`：在 `bridge()` 的 `socket.on("message")` **回调最前面**实现 **default-deny 帧分类**并**导出稳定接口** `classifyFrame(data, isBinary): FrameClassification`（`{kind, id?, method?, profile?, elements?}`，kind ∈ `request\|response\|notification\|batch\|invalid\|binary`）。判据**唯一**：解析后是否含 `method` 字符串。**二进制帧拒绝**、JSON 解析失败拒绝、数组批帧逐元素分类、`null`/数字/字符串拒绝。同时实现 `params.profile` 守卫（复用 `userCanAccessProfile`，`users/repo.ts:139-144`）与 `default_profile` 注入。越权回 `{error:{code:403,message,data:{code:"PROFILE_FORBIDDEN"}}}`，**不转发、不入 pending**。**明确禁止**以「无 `id`」「带 `result`/`error`」为免拦理由；**分类判据**：存在 `method` 键（值非 `undefined`）即为 request；`method` 值**非字符串** → 判为 `invalid` 并拒绝（不得归入「不含 method」而直转）；batch 帧**逐元素守卫**，任一元素越权则**整批拒绝**（不转发任何元素）；未知方法按需 profile 处理（不得放行） | REQ-008, REQ-017 | **critical** | TASK-001 | 单测（TASK-004）+ 代码评审确认导出 `classifyFrame` 且 4 条绕过路径均拒绝 |
| TASK-004 | `apps/server/src/hermes/proxy.test.ts`：新增 **30 例**（详见 `design.md §8.4`）：①`admin` 越权单帧 → 同 id 403 且上游未收到；②**绕过 A** 省略 `id` → 拒绝；③**绕过 B** 附 `error:null` → 拒绝；④**绕过 C** 数组批帧 → 逐元素守卫、上游未收到越权部分；⑤**绕过 D** 二进制帧 → 拒绝；⑥非法 JSON → 拒绝；⑦误拦防护（客户端回包无 `method` → 直转）；⑧回归 `profiles.list` 无 `profile` 放行；⑨REQ-017 注入 `profile=alpha`；⑩REQ-017 无分配 profile → 403；⑪REQ-018 超 `maxPayload` → 可读错误 + 仅该连接关闭；⑫REQ-015 白名单过滤；⑬REQ-015 fail-closed（上游返回 `{nope:1}` → 不下发全量）。需给 `startEchoUpstream` 扩展「记录收到的原始帧」；⑭MethodSweep（INTERFACES 全方法清单逐条断言「注入/403/豁免」三选一，无遗漏）；⑮非豁免方法（cron.manage / vault.list / tools.list / plugins.manage / skill_manage / connectors.*）均注入或 403；⑯上游 `{id,error}` 原样透传（不替换为 BFF 500）；⑰伪造 id + 并发 1000 次 `profiles.list` → 长度上限与超时清理生效；⑱越权/fail-closed/REST 403 → audit 各 1 条且不含 token/字节；⑲`"method":123` → invalid 并拒绝；⑳MethodSweep（以 `contracts/*.py` 参数类为数据源，断言论断「豁免集合 == **参数类无 `profile` 字段集合**」）；㉑`complete.path`/`llm.oneshot`/`tools.list`/`toolsets.list`/`tools.show` 缺 profile **均被注入**；㉒未知方法 `totally.unknown` **被注入**；㉓batch 任一元素越权 → **整批拒绝**且上游未收到任何元素；㉔REST 无 profile 请求被注入或 403；㉕REST 无任何分配 profile → 403；㉖REST `/api/hermes/health` 豁免；㉗队列字节预算恰 64 MiB / 超 1 字节；㉘`tools.list`/`toolsets.list`/`tools.show`/`reload.env`/`plugins.list`/`learning.*`/`image.generate` 缺 profile → **均不注入**（不得触发 4000）；㉙`commands.catalog`/`config.show`/`cron.manage`/`shell.exec` 缺 profile → **均注入**；㉚MethodSweep 机械断言「豁免集合 == 参数类无 `profile` 字段集合」 | REQ-008, REQ-015, REQ-017, REQ-018 | critical | TASK-003 | vitest（server）全绿 |
| TASK-029 | **REQ-015 响应过滤**：在 `proxy.ts` 的**上游→客户端**路径（`:76`）用 `classifyFrame` 记录的 `pendingProfileReads: Map<id,{userId,kind}>` 匹配 `profiles.list`/`profiles.describe` 响应，按 `user_profiles` 白名单过滤 `result.profiles[]` 后下发。**fail-closed**：响应非 JSON / 结构不符（缺 `profiles` 键或非数组）/ 过滤异常 → **不下发**并回 `{error:{code:500,message:"profiles 过滤失败"}}`。`profiles.describe` 的未分配 `name` → 403。`super_admin` 不过滤。`pendingProfileReads` 须有长度上限与超时清理。**依赖 TASK-003 导出的 `classifyFrame`，不得自行解析帧** | REQ-015 | high | TASK-003 | vitest（server）：白名单过滤 + fail-closed + 上限清理 |
| TASK-030 | **REQ-017 租户上下文注入（default-deny + schema 派生豁免清单）**：非 `super_admin` 的 request 帧缺 `params.profile` 时——**参数类 schema 未声明 `profile`** 的方法豁免（不得注入，否则 `extra="forbid"` → 4000）；**其余一切方法（含清单外未知方法）** 注入 `default_profile`；无可用 → 403。**豁免清单（18 条）**：`ping`/`gateway.capabilities`/`client.capabilities`/`complete.slash`/`reload.env`/`reload.mcp`/`plugins.list`/`learning.frames`/`learning.detail`/`learning.delete`/`paste.collapse`/`model.save_key`/`model.disconnect`/`diagnostics.share_nous`/`image.generate`/`tools.list`/`toolsets.list`/`tools.show`。**须注入（声明了 `profile`）**：`commands.catalog`/`config.show`/`cron.manage`/`shell.exec`/`cli.exec`/`process.kill`/`tools.configure`/`browser.manage`/`agents.list`/`insights.get`/`session.set_hidden`/`complete.path`/`llm.oneshot`。**禁止**前缀白名单、禁止把未知方法当豁免、**禁止以「是否直继 `Params`」为判据**。MethodSweep 须机械断言「豁免集合 == 参数类无 `profile` 字段集合」 | REQ-017 | **critical** | TASK-003 | vitest：18 条豁免均不注入 / **13 条**须注入方法均被注入 / 未知方法被注入 / 无分配 403 / super_admin 不注入 / **MethodSweep 机械断言通过** |
| TASK-036 | **R24 残余闭合（session 归属）**：`tools.list` / `toolsets.list` / `tools.show` 等 `_SessionScoped` 方法 schema 无 `profile` 字段，无法 profile 守卫；其 handler 缺 `session_id` 时回退**启动 profile** 配置（`tools_mcp_plugins.py:20-21`）→ 跨租户读取。须做 **session 归属校验**（校验 `session_id` 所属 profile ∈ 调用者白名单）或显式禁用 | R24（§10 残余） | **high** | 独立任务（不阻塞 Wave 1 主线） | vitest：跨租户 `session_id` 被拒；本租户通过 |
| TASK-035 | **REQ-022 REST 守卫**：`routes/hermes.ts` 的 `assertProfileAccess` 去掉「缺 `profile` 即提前 `return`」；非 `super_admin` 请求除豁免路径（`/api/hermes/health`）外，缺 `profile` → 注入调用者 `default_profile`（写入 query 或 body，与 `requestProfile` 读取位置一致）后执行守卫；无可用 → 403。**禁止**把未知路径当豁免；**并断言上游实际收到 `profile`**（注意 `routes/hermes.ts:94-95` 使用 `request.url` 构造上游 target，而 `requestProfile` 读 `request.query`/`request.body`（`:30-32`）——注入必须落入**被转发的 query 字符串**，否则守卫通过但上游不按租户作用域，静默失效） | REQ-022 | **critical** | TASK-001 | vitest（`routes/hermes.test.ts`）：注入 / 403 / health 豁免 / super_admin 不拦；既有 `profile guard` 用例保持绿 |
| TASK-034 | **REQ-021 审计接入**：`hermes/proxy.ts`（WS 403 与 fail-closed）与 `routes/hermes.ts`（REST 403）调用 `apps/server/src/audit/repo.ts` 写审计（action / actor / profile / method / ip / 结果 / ts），**不含 token / 密钥 / 文件字节** | REQ-021 | high | TASK-003, TASK-029 | vitest：三类事件各恰 1 条记录；断言零 token/字节泄漏 |
| TASK-031 | **REQ-018 上限**：为 WS 显式设 `maxPayload`（**同时作用于客户端接入侧与上游侧 socket**）与 `pending`/`outbound` 队列上限——**条数 AND 累计字节**（**`maxPayload = 16 MiB`**、**`K = 4`** → 单连接累计 ≤ **64 MiB**）；超限回可读错误并**仅**终止该连接 | REQ-018 | medium | TASK-003 | vitest：条数超限、**字节超限**、仅该连接关闭 |
| TASK-005 | 新建 `apps/web/src/chat/composer/pendingAttachments.ts` 纯函数：`kindOf`、`screenFiles`（**读取内容之前**按 `size` 拒绝 >10MB；单批 ≤10；错误含文件名与上限；不影响合法项）、`dedupe`、`readAsBase64`（`FileReader.readAsDataURL` 异步） | REQ-005, REQ-007 | high | — | vitest + 边界遍历（0 / 10MB / 10MB+1 / 第 11 个 / 空数组）+ 断言未读取超限文件内容 |
| TASK-006A | `apps/web/src/chat/composer/controlsReducer.ts`：**纯 reducer**，管理 `selection{profile,model,cwd,yolo}` 与 `attachments`；动作含 select/rollback/attach/remove/clear/**single-flight 标志**。不含任何 RPC | REQ-001, REQ-002, REQ-003, REQ-009, REQ-012, REQ-013 | high | — | vitest：状态转移表 + 属性（回滚无残留） |
| TASK-006B | `apps/web/src/chat/composer/useOptions.ts`：options 生命周期 + **会话键缓存**（hero 用占位键 `"__hero__"`；create 成功后**迁移**键为 storedId 而**不重载**；`profile` 变更视为新键）。加载须带 `profile`（REQ-019）：`model.options{profile}`、`/api/hermes/chat/workspaces?profile=<name>`、`me.profiles`。StrictMode 用 `Map` + `inFlight` Promise 去重；键文法 `<sessionKey>::<profile>`；`send()` 期间**冻结** `selection.profile` 为 `frozenProfile`，迁移以 frozenProfile 为准（AgentPicker 发送中 disabled） | REQ-002, REQ-007, REQ-009, REQ-012, REQ-019 | high | — | vitest：缓存迁移断言（≤1 次加载）+ 参数含 `profile` |
| TASK-006C | `apps/web/src/chat/composer/useSessionControls.ts`：RPC 动作（`selectModel` / `selectProfile` / `selectWorkspace` / `selectYolo` / `confirmModel`）在 reducer dispatch **外层**；`modelSwitch` 状态机（idle/pending/deferred/confirm/error）；**`reconcileModel()`**（仅 `deferred` 时调 `model.options{session_id}` 并以回包 `model` 回正，不一致则回滚 + 提示「切换未生效」）；`send()` **single-flight**；`identityReady = activeId !== null && identity?.storedId === activeId`（**hero 态 `activeId === null` 不判为未就绪**）；保留 docked 4001 有界重试 | REQ-010, REQ-010a, REQ-011, REQ-011a, REQ-014 | high | TASK-006A | vitest：三态 + 回正触发 + single-flight + hero 不被拦截 |
| TASK-007 | `composer/modelCatalog.ts#normalizeModelCatalog`（WS `model.options` → `{options[], current}`，含 `capabilities.fast` → `Flash` 徽标、`authenticated`、`pricing`；缺失**不臆造**；去重键 `provider::id`）与 `composer/agentOptions.ts#normalizeAgentOptions`（`me.profiles` → 白名单，**绝不回退** `profiles.list`）。**不改** `settings/model.ts` | REQ-002, REQ-009, REQ-012, REQ-019 | high | — | vitest + 新测试文件，不动 `types.test.ts` |
| TASK-008 | 扩展 `test/fakeGateway.ts`（仅当 `impl` 返回空时补默认；**不改** `resume`/`create` 的 R≠S 默认）支持 `config.set` 的 `deferred`/`confirm_required`、`model.options`（含 `model`/`capabilities.fast`）、`attach*` 的 `ref_text`；扩展 `apps/web/src/api/ws.ts:112-119` 读取 `error.data.code` 字符串 | REQ-006, REQ-008, REQ-009, REQ-010, REQ-010a, REQ-011, REQ-012 | high | — | 既有测试仍全绿 + `ws.test.ts` 新增 `error.data.code` 断言 |
| TASK-028 | 新建 `apps/web/src/chat/composer/MenuButton.tsx`：APG Menu Button 手写原语（`aria-haspopup="menu"` / `aria-expanded` / `aria-controls`；`role="menu"` + `role="menuitem"`；`Enter`/`Space`/`ArrowDown` 打开并聚焦首项；`ArrowUp/Down`/`Home/End`；`Esc` 关闭并**归还焦点**；`Tab` 关闭；`useId()`）。同时修复 `apps/web/src/chat/SessionList.tsx` 的两处菜单（其一子项缺 `role="menuitem"`、两者缺 `Esc` + 焦点归还） | REQ-016 | medium | — | vitest（a11y 断言）+ `SessionList` 既有测试仍绿 |
| TASK-032 | **REQ-015 过滤行为测试**（从 TASK-025 拆出）：`admin` 收白名单、`super_admin` 收全量、`describe` 未分配 → 403、结构不符 → fail-closed、`pendingProfileReads` 上限与超时清理；上游 `{id,error}` **原样透传**（不替换为 BFF 500）；伪造 id 与并发洪泛由超时清理 + 长度上限兜底；batch 帧不在响应过滤机制内（按 TASK-003 整批拒绝语义处理） | REQ-015 | high | TASK-029 | vitest（server） |
| TASK-033 | 归档可核验的契约片段到 `.psd/specs/003-composer-redesign/v1.0.0-20260929-173000/contracts-evidence.md`（含 `session.create` 参数、`config.set` 的 `deferred`/`confirm_required`、`model.options` 结构、`message.complete` 事件、`session.status` 仅 `output`、`profiles.list` 无过滤），使安全判据可被 CI/仓库独立复核；并显式列出「无法用 profile 守卫的方法集合」（`_SessionScoped` 类：`tools.list`/`toolsets.list`/`tools.show`）与其残余风险（R24） | REQ-008, REQ-010a, REQ-011, REQ-015 | medium | — | 文件存在且与官方源码逐条对应 |

## Wave 2 — 展示组件（依赖 Wave 1）

| ID | 描述 | REQ Link | 优先级 | 依赖 | 验证方式 |
|----|------|----------|--------|------|----------|
| TASK-009 | 新建 `composer/ComposerControls.tsx`：hero pill 行（`智能体 · 工作区 · 模型`）+ 底行（`＋ ｜ 权限模式 ｜ 弹性空位 ｜ 模型 ｜ 发送/停止`）。**不渲染**语音与 git 分支 | REQ-002, REQ-003, REQ-016 | high | TASK-006A, TASK-028 | 结构断言（DOM 集合精确匹配） |
| TASK-010 | 新建 `composer/ModelPicker.tsx`（controlled）：本会话覆盖选择 + `Flash` **只读徽标**（来自 `capabilities.fast`）+ `deferred` 提示槽 + `confirm` 二次确认（`role="alertdialog"`）；`identityReady===false` 时 `disabled` | REQ-009, REQ-010, REQ-011 | high | TASK-006C, TASK-007, TASK-028 | 组件测试（三态） |
| TASK-011 | 新建 `composer/AgentPicker.tsx`（controlled）：选项恒 = `me.profiles`；hero 可选，docked 只读 + 提示「切换将新建会话」（A1） | REQ-002, REQ-014 | high | TASK-007 | 组件测试（断言不含 `profiles.list` 值） |
| TASK-012 | 新建 `composer/WorkspacePicker.tsx` 与 `composer/PermissionPicker.tsx`：工作区 hero（写 create 参数）vs 会话内（`session.workspace.move{session_key:storedId}`，失败回滚）；权限模式 `config.set{key:"yolo",scope:"session"}`，失败回滚选中态 | REQ-012, REQ-013 | high | TASK-006A, TASK-006B, TASK-007 | 组件测试（回滚断言） |
| TASK-013 | 新建 `composer/UploadMenu.tsx` + 在 `Composer` 加拖拽/粘贴处理（**浏览器** File API / `ClipboardEvent`，**禁用** `clipboard.paste` / `input.detect_drop`）+ 可聚焦的文件选择按钮（WCAG 2.5.7）+ dropzone `aria-describedby`；`＋` 菜单并入 子代理/命令/上下文/人格/图片生成 入口 | REQ-005, REQ-007, REQ-016 | high | TASK-005, TASK-028 | 组件测试（drop/paste 事件；断言 0 RPC） |
| TASK-014 | 新建 `chat/SessionHeaderMenu.tsx`：`连接 / 导入 / 导出 / 分享 / 重命名`（复用 TASK-028 的 `MenuButton`）；重命名走 `session.title{runtimeId}`；导入/导出迁移既有 handler；分享沿用 `?session=<storedId>` + 剪贴板 | REQ-004, REQ-016 | medium | TASK-028 | 组件测试（恰 5 项） |
| TASK-015 | 改 `chat/Composer.tsx`：新增 `variant?: "hero" \| "docked"`（默认 `"docked"`）以 `data-variant` 切布局；拆出附件 chip 区；修正发送守卫与按钮 `disabled`（`Composer.tsx:108` / `:284`）以纳入附件（现只看 `draft`/`references`）。**关键**：hero 与 docked 必须**同一实例**，禁止条件渲染两个组件（否则丢 `draft`/chip）。既有 aria-label（`消息`/`发送`/`停止`/`添加附件`/`移除引用`）**不得改名** | REQ-001, REQ-003, REQ-005 | high | TASK-005, TASK-009, TASK-013 | 组件测试 + `Composer.test.tsx` 回归 |

## Wave 3 — ChatPage 装配（依赖 Wave 2）

| ID | 描述 | REQ Link | 优先级 | 依赖 | 验证方式 |
|----|------|----------|--------|------|----------|
| TASK-016 | `ChatPage.tsx` 双态渲染：把 `Composer` 从 `{active ? ...}` 条件内**提出**；新建 `chat/HeroIntro.tsx`（大标识 + 标题 + 最近会话，数据复用现有 `sessions`）；替换 `:910-920` 的 `EmptyState` | REQ-001 | high | TASK-015 | 集成测试（hero/docked 互斥） |
| TASK-017 | 发送编排改**延迟绑定**：hero 状态按 `session.create(buildCreateParams())` → `uploadAll(runtimeId)`（逐条，runtime id）→ `prompt.submit`；任一失败中止后续并透传 message；create 失败保持 hero 且保留 draft/chip；**single-flight**（发送进行中重复触发恒不产生第 2 次 `session.create`）。同步重写 `handleAttach`（现为即时 RPC，且参数形状不符合契约）；会话域 RPC（`session.list`/`most_recent`/`resume`/`events.since`）在有 `selection.profile` 时**显式携带** `params.profile`（REQ-020） | REQ-006, REQ-008, REQ-012, REQ-017, REQ-020 | high | TASK-008, TASK-015, TASK-030 | 集成测试（调用序 + single-flight 断言） |
| TASK-018 | 模型提交路径接线：hero → `session.create.model`（**无**二次确认，REQ-011a）；会话内 → `config.set{key:"model",session_id:runtimeId,confirm_expensive_model?}`；接 `deferred`（提示「将于下一回合生效」）与 `confirm`（以回包 `confirm_required` 为**唯一判据**，前端不预判昂贵）分支；**ChatPage 在收到 `message.complete` 时调用 `reconcileModel()`** 以 `model.options{session_id}.model` 回正（不一致则回滚 + 提示「切换未生效」） | REQ-009, REQ-010, REQ-010a, REQ-011, REQ-011a | high | TASK-006C, TASK-010, TASK-017 | 集成测试（三态 + 回正 + single-flight） |
| TASK-019 | 权限模式接线：`config.set{key:"yolo",scope:"session"}` + 失败回滚 UI 选中态 | REQ-013 | medium | TASK-006A, TASK-012, TASK-017 | 集成测试 |
| TASK-020 | 会话头菜单接入 + **身份键正确性**：`rename`/`interrupt`/`attach*` 用 runtime id；`workspace.move` 用 **stored id**（字段 `session_key`）；移除顶部 9 按钮工具栏（`:786-862`），面板挂载点（`SubagentsPanel`/`ImageGenAction`/`ContextFilesPanel`/`PersonalityPanel`/`CommandPanel`）保持不动 | REQ-004, REQ-012, REQ-014 | high | TASK-014, TASK-017 | 集成测试（身份键断言） |
| TASK-021 | `styles.css`：hero 布局 / docked 常驻 / pill / chip 缩略图 / 菜单 / dropzone / `Flash` 徽标 / `model-confirm`；**仅 `--ds-*` token**，圆角 `--ds-radius-*`；hero 容器预留稳定 `min-height` 防 CLS；过渡只动 `transform`/`opacity`；建议 `@container chat (width < 600px)`；修复 `.composer-file` 若为 `display:none` → visually-hidden + `:focus` 可见指示 | REQ-001, REQ-002, REQ-003 | high | TASK-015 | token grep（无硬编码色值）+ 视觉自查 |

## Wave 4 — 测试补齐（依赖 Wave 3）

| ID | 描述 | REQ Link | 优先级 | 依赖 | 验证方式 |
|----|------|----------|--------|------|----------|
| TASK-022 | 组件 a11y / 键盘测试：`aria-label` 覆盖、菜单 APG 属性、`Esc` 关闭 + 焦点归还、`role="alert"`/`role="status"`、拖拽区 `aria-describedby` | REQ-002, REQ-003, REQ-004, REQ-005, REQ-016 | medium | TASK-009..015, TASK-028 | vitest |
| TASK-023 | ChatPage 集成：hero→发送→docked、上传顺序 `create ≺ attach* ≺ submit`、**single-flight（并发双击恒 1 次 create）**、10MB/超 10 个拒绝、模型 `deferred` → `message.complete` → `reconcileModel` 回正（含不一致回滚）、`confirm` 二次确认、`config.set` 带 runtime id | REQ-001, REQ-006, REQ-007, REQ-009, REQ-010, REQ-010a, REQ-011, REQ-011a | high | TASK-016..021 | vitest |
| TASK-024 | StrictMode 双调用幂等：hero↔docked 不丢 draft/chip、附件不重复入 chip、`create` 不双调、**options 缓存键 `"__hero__"` → storedId 迁移（同一逻辑会话恒 ≤1 次加载）**、`previewUrl` 不重复 revoke；并回归 `handleSend` 4001 有界重试（REQ-014 未改变该语义）与 **hero 态发送不被禁用** | REQ-001, REQ-005, REQ-006, REQ-014 | medium | TASK-016, TASK-017 | vitest |
| TASK-025 | BFF 守卫端到端（帧分类视角）：4 条绕过路径（通知化 / 多余成员 / 数组批帧 / 二进制）全部拒绝 + `super_admin` 放行 + 响应帧不误拦 + `profiles.list` 无 `profile` 放行 + REQ-017 注入与 403 + REQ-018 超限 | REQ-008, REQ-017, REQ-018 | critical | TASK-003, TASK-004 | vitest（server） |
| TASK-026 | （可选，单独跑）e2e：hero 上传（点击 + 拖拽）→ 发送 → docked；CLS / container query 需真实浏览器，jsdom 无法断言 | REQ-001, REQ-006 | low | TASK-023 | `npm run test:e2e` |

## Wave 5 — 收口

> **注**：REQ-015 / REQ-017 / REQ-018 的安全实现已上移至 Wave 1（PR-011 安全同波次）；本波次只做最终验证。

| ID | 描述 | REQ Link | 优先级 | 依赖 | 验证方式 |
|----|------|----------|--------|------|----------|
| TASK-027 | `npm run check` 全绿 + 基线一致性复核（防漂移）：逐条比对 `requirements.md` 与本 Spec 的 REQ（含 REQ-010a / 011a / 013..019）是否已在基线文档落地 | REQ-001..022（含 010a / 011a / 018a / 018b） | high | TASK-001..026, TASK-028..033 | `npm run check`；人工比对清单 |

---

## 追溯矩阵

| Requirement | Tasks | 覆盖 |
|-------------|-------|------|
| REQ-001 | TASK-001, 006A, 015, 016, 021, 023, 024 | full |
| REQ-002 | TASK-001, 006A, 006B, 007, 009, 011, 021, 022 | full |
| REQ-003 | TASK-001, 006A, 009, 015, 021, 022 | full |
| REQ-004 | TASK-014, 020, 022, 028 | full |
| REQ-005 | TASK-001, 005, 013, 015, 022, 024 | full |
| REQ-006 | TASK-008, 017, 023, 024, 026 | full |
| REQ-007 | TASK-005, 013, 023 | full |
| REQ-008 | TASK-001, 003, 004, 008, 017, 025, 033 | full |
| REQ-009 | TASK-002, 006A, 006B, 007, 008, 010, 018, 023 | full |
| REQ-010 | TASK-006C, 008, 010, 018, 023 | full |
| REQ-010a | TASK-006C, 008, 018, 023, 033 | full |
| REQ-011 | TASK-006C, 008, 010, 018, 023, 033 | full |
| REQ-011a | TASK-006C, 018, 023 | full |
| REQ-012 | TASK-006A, 006B, 007, 012, 017, 020 | full |
| REQ-013 | TASK-006A, 012, 019 | full |
| REQ-014 | TASK-006C, 011, 014, 020, 024 | full |
| REQ-015 | **TASK-029, TASK-032**, TASK-004, TASK-033 | full |
| REQ-016 | TASK-009, 013, 014, 022, 028 | full |
| REQ-017 | **TASK-030**, TASK-003, TASK-004, TASK-025 | full |
| REQ-018a | TASK-031, TASK-004 | full |
| REQ-018b | TASK-031, TASK-004 | full |
| REQ-020 | TASK-017, TASK-020 | full |
| REQ-021 | **TASK-034**, TASK-004, TASK-025 | full |
| REQ-022 | **TASK-035**, TASK-004 | full |
| REQ-018 | **TASK-031**, TASK-004, TASK-025 | full |
| REQ-019 | TASK-006B, 007 | full |
| R24（session 归属残余） | **TASK-036**, TASK-030, TASK-033 | partial（已登记并规划） |

**孤儿任务检查**：TASK-001 / TASK-002 = 基线（映射全部 REQ）；TASK-026 = e2e（REQ-001/006）；TASK-027 = 全局验证；TASK-033 = 契约归档（REQ-008/010a/011/015）。**无未映射任务。**

**粒度检查**：单任务覆盖 REQ 数上限已由拆分前单任务的 9 条降至 **TASK-006A 的 6 条 / TASK-006B 的 5 条 / TASK-006C 的 5 条**（评审 MEDIUM #9）；安全项各自独立成任务，可独立验收。

## 依赖图（无环）

```
TASK-001 ─┬─> TASK-002
          ├─> TASK-003 ─┬─> TASK-004 ─┬─> TASK-025 ─┐
          │             ├─> TASK-029 ─┤            │
          │             │   └─> TASK-032           │
          │             ├─> TASK-030 ─┤            │
          │             ├─> TASK-031 ─┤            │
          │             └─> TASK-034 ─┘            │
          └─> TASK-035 ──────────────> (REST 守卫) ─┤
TASK-005 ─┬───────────────────> TASK-013 ──────────┤
          └───────────────────> TASK-015 ─┬────────┤
TASK-006A ─┬─> TASK-009 ──────────────────┤        │
           └─> TASK-012 / TASK-019 ───────┤        │
TASK-006B ─────> TASK-007 ─┬─> TASK-010 ──┤        │
                           └─> TASK-012 ──┘        │
TASK-006C ─┬─> TASK-010                            │
           └─> TASK-018                            │
TASK-008 ──────────────────> TASK-017 ─┬─> TASK-018 ─┐
TASK-015 ──────────────────> TASK-017   ├─> TASK-019 ─┤
TASK-028 ─┬─> TASK-009 / 010 / 013 / 014│            │
          └─> (修 SessionList)           └─> TASK-020 ─┤
TASK-030 ──────────────────> TASK-017                 │
TASK-014 ──────────────────> TASK-020                 │
TASK-016..021 ─────────────> TASK-022 / 023 / 024 ────┤
TASK-023 ──────────────────> TASK-026 ────────────────┤
TASK-001..026, 028..035 ───> TASK-027 <───────────────┘
TASK-030, TASK-033 ────────> TASK-036（独立任务，不阻塞主线）
```
（注：TASK-030/031/034 依赖 TASK-003；TASK-035 只依赖 TASK-001；TASK-025 汇总依赖 TASK-003/004。）

**关键路径**：`TASK-001 → TASK-003 → TASK-017 → TASK-020 → TASK-023 → TASK-027`

## 一致性检查清单

- [ ] 所有 GEARS 需求（REQ-001..022，含后缀 010a / 011a / 018a / 018b）都能映射到测试用例
- [ ] 依赖图无环；`classifyFrame` 由 TASK-003 导出并被 TASK-029 复用（**无脆弱耦合**：响应过滤不再自行解析帧）
- [ ] 无孤儿任务（每个 TASK 至少链接 1 个 REQ）
- [ ] 每条 REQ 至少被 1 个 TASK 覆盖；**过滤/注入/上限行为各有独立测试任务**（TASK-032 / TASK-004 / TASK-025）
- [ ] 单任务覆盖 REQ 数 ≤ 6（原单任务已拆为 006A/006B/006C）
- [ ] 安全项同波次：REQ-008 / REQ-015 / REQ-017 / REQ-018 全部在 **Wave 1**（PR-011）
- [ ] 身份键矩阵未被破坏：`workspace.move` = stored；`title`/`interrupt`/`attach*`/`config.set(session_id)` = runtime
- [ ] `npm run check` 全绿；e2e 单独跑
- [ ] 基线 4 份文档 + `docs/TASKS.md` + `task-list.md` 已与实现一致（防漂移）
- [ ] `contracts-evidence.md` 已归档（TASK-033），安全判据可被仓库独立复核
- [ ] REQ-017 为 **default-deny + 显式豁免 allowlist**，并有 **MethodSweep** 测试（以 `docs/INTERFACES.md` 全清单逐条断言）
- [ ] 队列上限同时约束**条数**与**累计字节**（TC-018 / REQ-018a）
- [ ] 守卫拒绝与 fail-closed 均写审计（REQ-021 / TASK-034），且**不含 token / 字节**
- [ ] WS 与 REST 的租户上下文均为 **default-deny**，且豁免清单**从契约派生**（WS **18 条** / REST **1 条**），未知方法/路径按需 profile 处理（REQ-017 / REQ-022 / TC-019）
- [ ] `maxPayload = 16 MiB`、`K = 4`（累计 ≤ 64 MiB）已量化，可独立断言（REQ-018b）
- [ ] batch 任一元素越权 → **整批拒绝**，无局部转发（REQ-008）
- [ ] REQ-017 判据为 **「参数类 schema 是否声明 `profile` 字段」**（非「是否直继 `Params`」），豁免清单 18 条，MethodSweep 机械断言可独立通过
- [ ] `tools.*` 等 `_SessionScoped` 方法的跨租户风险已登记（R24）并单开 TASK-036
