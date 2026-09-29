# Specification: 对话页重构（openclaw 风格 hero + 会话控件）

> Spec ID: 003-composer-redesign | Phase: requirements | Workflow: requirements-first | Version: v1.0.0-20260929-173000
> 状态：**approved-for-build**
> 基线：`requirements-draft.md`（同目录，已获用户批准）+ Gate 2 的 6 处订正 + 2 项新增（REQ-015/016）

## 1. 业务背景

对话页是 24H Web 的核心工作台。重构前的问题：

- 空态只有图标 + 「新建会话」按钮（`apps/web/src/chat/ChatPage.tsx:910-920`），无首屏引导。
- 输入框（`apps/web/src/chat/Composer.tsx`，291 行）仅有附件 / slash / `@` 引用 / 发送，**无模型选择器**——而 `requirement.md:26` 与 `ui-spec.md:23/31` 早已写「模型就地切换」「模型在输入框」，代码从未实现（基线漂移）。
- 9 个功能按钮平铺在顶部工具栏（`ChatPage.tsx:786-862`），主次不分。
- 对话页**无法选择智能体（profile）**：`session.create` 传 `{}`（`ChatPage.tsx:390`）。
- 上传只能通过单个 file input；无拖拽、无粘贴；且现有实现向 `image.attach`/`pdf.attach`/`file.attach` 统一传 `{session_id,name,size,type}`（`ChatPage.tsx:604-610`），**不符合契约要求**（契约需 `path` 或字节），网关很可能报错。
- **租户边界在 WS 路径失守**：`apps/server/src/hermes/proxy.ts:105-111` 只转发 `connection` 查询参数，无 profile 守卫；REST 路径已有 `assertProfileAccess`（`routes/hermes.ts:34-46`）。
- **`profiles.list` 租户元数据泄漏**：`tui_gateway/methods_profiles.py:266-285` 不按调用者过滤，任意登录用户（含 `admin`）可枚举全部 profile 的 `name/path/model/description`；`AgentsPage.tsx:90` 与 `GroupChatPage.tsx:66` 已在调用。

**目标**：把对话页重做为 openclaw 式「双态 + 会话内控件」，并闭合基线漂移与租户边界缺口。

**租户边界缺口分三个维度，本 Spec 的处置如下**：

| 维度 | 缺口 | 处置 |
|---|---|---|
| **① `params.profile`** | BFF WS 代理无 profile 守卫（`proxy.ts:105-111`），且帧分类 fail-open（见 §9 R13） | **REQ-008 闭合**（改为 default-deny） |
| **② profile 元数据枚举** | `profiles.list` 不按调用者过滤，可枚举全部 profile 的 `name/path/model/description` | **REQ-015 闭合**（响应方向白名单过滤 + fail-closed） |
| **③ 会话 ID 寻址** | `session.list` / `session.resume` / `session.events.since` 以会话 id 寻址、**不含 `params.profile`** → 落到**启动 profile** 的存储，构成跨租户读写 | **REQ-017 闭合**（服务端强制注入调用者 `default_profile`） |

**残余缺口（显式登记，不在本 Spec 闭合）**：`workspaces` 与 `model.options` 的授权语义已由 REQ-012 / REQ-002 要求显式携带 `profile` 参数闭合；服务端 magic bytes 校验落点（R10）与 `session.*` 白名单方法清单的完备性（R14）留待实现阶段验证。

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

| ID | 优先级 | Where | While | When | Subject | Response（shall） | 验收标准（GWT） |
|----|--------|-------|-------|------|---------|------------------|-----------------|
| REQ-001 | high | 对话页已挂载（已认证） | `activeId === null 且 itemCount === 0` | 渲染 / 追加首条消息 | 对话页 | shall 渲染**居中 hero**（大标识 + 标题 + pill 行 + 大输入框 + 最近会话）；有消息时输入区切为 **docked 贴底常驻** | Given 已登录且无活动会话, When 进入对话页, Then `.chat-hero` 存在且含大输入框与「最近会话」区; Given 已有活动会话或已有消息, When 渲染, Then hero 移除、输入区贴底常驻 |
| REQ-002 | high | 对话页已挂载 | hero 态 | hero 渲染 | 输入区 | shall 在 pill 行渲染 `智能体 · 工作区 · 模型` 三个控件，**智能体选项仅取 `/api/auth/me` 的 `profiles[]`** | Given `me.profiles = ["p1","p2"]`, When hero 渲染, Then 智能体 pill 选项恰为 `{p1,p2}` 且**不含** `profiles.list` 的全量值 |
| REQ-003 | high | 对话页已挂载 | 任意态 | 输入区渲染 | 输入区 | shall 在底行渲染 `＋ ｜ 权限模式 ｜（弹性空位）｜ 模型 ｜ 发送/停止`，且 **不**渲染语音与 git 分支 pill | Given 输入区渲染, When 查询 DOM, Then 底行控件集合精确匹配; 断言 `voice-live` 与 branch pill **不存在** |
| REQ-004 | medium | 存在活动会话 | 用户点击会话头 `···` | 会话头菜单 | shall 提供 `连接 / 导入 / 导出 / 分享 / 重命名` 五项 | Given 有活动会话, When 点 `···`, Then 菜单恰含 5 项; `重命名` 走 `session.title{runtimeId}`; `分享` 沿用 `?session=<storedId>` + 剪贴板 |
| REQ-005 | high | 对话页已挂载 | 输入区可见 | 点击 `＋` 选文件/图片/PDF、或拖拽入框、或粘贴图片 | 上传模块 | shall 生成前端 chip 暂存（File 对象），**hero 态不得触发任何 RPC** | Given hero 态, When `＋→图片` 选 1 图, Then 出现 1 chip 且 `gateway.request` **调用数为 0**; Given 拖拽 3 文件, When drop, Then 3 chip 且无 RPC; Given 粘贴含图片的 `ClipboardEvent`, Then 走**浏览器 Clipboard API**（**非** `clipboard.paste` / `input.detect_drop`） |
| REQ-006 | high | 对话页已挂载 | 有待发送文本或 chip，且发送流程未在进行中 | 用户发送且当前无活动会话 | 发送流程 | shall 严格按 `session.create` → `attach*`（逐附件）→ `prompt.submit` 顺序执行；任一失败中止后续并透传网关真实 message；**shall 实施 single-flight**（发送未结束时忽略重复触发，不得并发发出两次 `session.create`） | Given hero + 文本 + 2 附件, When 发送, Then 调用序为 `session.create` → `image.attach_bytes{content_base64,filename}` / `file.attach{data_url,name}` / `pdf.attach{content_base64,filename}`（逐条，runtime id）→ `prompt.submit`; Given 第 1 个 attach 报错, Then **不调用** `prompt.submit` 且展示网关 message; Given 发送进行中再次点击发送/按 Enter, Then `session.create` 调用数仍为 1 |
| REQ-007 | medium | 对话页已挂载 | 用户选择文件 | 单文件 `size > 10MB`，或单批 > 10 个 | 上传模块 | shall **在读取内容之前**拒绝该文件并给含文件名与上限的可读错误，不影响其余合法文件 | Given 选择 12MB 文件, When 校验, Then 该 chip 被拒 + 错误含「10MB」且**未发生文件内容读取**; 同一批的 1MB 文件仍入 chip; Given 单批 11 个文件, Then 仅前 10 个入 chip |
| **REQ-008** | **critical** | BFF WS 代理路径已建立 | 角色非 `super_admin` | 客户端 WS 帧**含 `method` 字符串**（无论是否带 `id`、无论是否带 `result`/`error`）且 `params.profile` 指向未分配 profile | **BFF WS 代理** | shall 以 **default-deny** 分类：凡含 `method` 字符串的帧一律按 request 处理并施加守卫（**不得**因缺 `id` 或存在 `result`/`error` 而以「通知/响应」名义放行）；JSON 数组批帧 shall **逐元素**分类与守卫；**二进制帧 shall 拒绝**（L1 为文本 JSON-RPC）；JSON 解析失败 shall 拒绝；越权时以同 `id`（批帧为错误数组）回 `403 PROFILE_FORBIDDEN` 且**不转发** | Given `admin` 未分配 `px`, When WS 发 `{jsonrpc,id:1,method:"session.create",params:{profile:"px"}}`, Then 收到同 `id` 的 403 且上游未收到该帧; Given 同上但**省略 `id`**（通知化）, Then **同样** 403/拒绝且不转发; Given 同上但**附带 `"error":null`** 或 `"result":null`, Then **同样**拒绝且不转发; Given 发 `[{...profile:"px"...}]`（数组批帧）, Then 逐元素守卫、越权元素被拒、上游未收到越权部分; Given 发 **二进制帧**, Then 拒绝且不转发; Given 客户端回包 `{id:9,result:{...}}`（**无 `method`**）, Then 正常转发不被拦; Given `super_admin`, Then 帧正常转发 |
| REQ-009 | high | 对话页已挂载 | hero 态（无 session） | 用户切换模型 pill | 模型控件 | shall **仅更新待创建会话的 `model` 参数**（不发 `config.set`）；会话内则发 `config.set{key:"model", value, session_id: runtimeId}` | Given hero + 选 `m-b`, When 发送, Then `session.create` 入参含 `model:"m-b"` 且 `config.set` 调用数为 0; Given 会话内 `runtimeId = R`, When 选 `m-b`, Then `config.set{key:"model", value:"m-b", session_id:R}` |
| REQ-010 | high | 会话运行中 | `running === true` | 用户切换模型 | 模型控件 | shall 接受选择并显示为目标模型；网关回包 `deferred:true` 时提示「将于下一回合生效」，**不得**在回合中途热切 | Given 回合运行中, When 切模型, Then UI 目标为新模型且出现「下一回合生效」提示 |
| REQ-010a | high | 会话已建立（`identityReady`） | `modelSwitch.status === "deferred"` | 收到该会话的 **`message.complete`** 事件（回合结束） | 模型控件 | shall 调用 **`model.options{profile: <当前 selection.profile 或 default_profile>, session_id: runtimeId}`** 并以回包 **`model`** 字段回正选中态；若 `model` ≠ 用户选择 shall 提示「切换未生效」并回滚选中态 | Given `deferred` 后收到 `message.complete`, Then 调用 `model.options` 一次且**参数同时含非空 `profile` 与 `session_id`**; Given 回包 `model === 用户选择`, Then 选中态保持且清除 pending; Given 回包 `model !== 用户选择`（stash 被丢弃）, Then 回滚选中态并提示「切换未生效」 |

**注**：契约中 **不存在 `session.info`**；`session.status` 回包仅 `{output: str}`（渲染文本），不可用于对齐。唯一结构化来源是 `model.options{session_id}` 回包的 `model` 字段（`config_free_tier_control.py:273-277`，doc: "layered over the session's live provider when given"）。
| REQ-011 | high | 会话已建立 | 用户选定模型 | 用户选定模型 | 模型控件 | shall 发 `config.set{key:"model", value, session_id}`；**前端 shall 不预判「昂贵」**（以网关回包为准）；若回包 `confirm_required === true` shall 展示 `confirm_message` 并等待确认，确认后 shall 以 `confirm_expensive_model:true` 重发，取消 shall 回滚选中态 | Given 会话内选模型, When `config.set` 回 `{confirm_required:true, confirm_message:"…"}`, Then 弹确认且**尚未落库**; When 用户确认, Then 第二次 `config.set` 携带 `confirm_expensive_model:true`; When 用户取消, Then 选中态回滚且无第二次调用 |
| REQ-011a | medium | 对话页已挂载 | hero 态（`activeId === null`） | 用户选定模型 | 模型控件 | shall **不做**前端二次确认（`session.create` 无 `confirm_expensive_model` 字段），仅写入待创建参数；若网关拒绝 shall 透传其 message | Given hero 选任意模型, When 发送, Then `session.create` 携带 `model` 且**无** `confirm_expensive_model` 相关弹窗; Given 网关拒绝, Then 展示网关 message（登记为风险 R13 / Ask First） |
| REQ-012 | high | 对话页已挂载 | 用户在工作区 pill 选择目录 | 选择动作 | 工作区控件 | hero 态 shall 写入 `session.create` 的 `cwd` **且 `cwd_explicit:true`**；会话内 shall 用 **stored id** 发 `session.workspace.move{session_key, cwd}`；工作区列表 shall 以当前 `profile` 作查询参数请求 `/api/hermes/chat/workspaces?profile=<name>` 以使 BFF `assertProfileAccess` 生效；**若无可用 `profile`（未选且 `default_profile` 为空）shall 不发起该请求**并展示可读错误（不得发起无 `profile` 的请求）；`cwd` shall **原样透传** | Given hero + 选 `/w/a`, When 发送, Then `session.create` 含 `cwd:"/w/a", cwd_explicit:true`; Given 未选目录, Then **省略 `cwd_explicit`**（不传 `false`）; Given 会话内 + 选 `/w/b`, Then `session.workspace.move{session_key: storedId, cwd:"/w/b"}`（断言**非** runtimeId）; Given 请求工作区列表, Then URL 含 `profile=<当前选择>`; **Given 无可用 profile, Then 请求数为 0 且展示可读错误**; Given 传入相对路径 `"./x"`, Then 原样透传 |
| REQ-013 | medium | 会话已建立 | 用户切换权限模式 | 选择非默认模式 | 权限控件 | shall 发 `config.set{key:"yolo", scope:"session"}`，且失败时**回滚 UI 选中态** | Given 会话内, When 选「自动批准」, Then `config.set{key:"yolo", scope:"session"}`; 回包错误, Then 选中态回滚并展示 message |
| REQ-014 | medium | 对话页已挂载 | **`activeId !== null` 且**（`identity === null` 或 `identity.storedId !== activeId`），即已有会话但身份未就绪 | 渲染 / 交互 | 运行中 RPC 守卫 | shall 禁用**会话域**控件并阻止 **runtime-id** RPC 发出；**hero 态（`activeId === null`）不适用本约束**——hero 发送走 `session.create`（不需要 runtime id）**不得被禁用**；且**不改动** docked 已有会话上 `prompt.submit` 的 4001 有界重试语义 | Given 点选非活动行触发 resume 中（`activeId !== null`）, When 用户点发送, Then runtime-id RPC 被本地拦截且 `prompt.submit` 未发出; **Given hero 态（`activeId === null`）且有文本, Then 发送可用**（`session.create` 路径不受影响）; Given docked 已有会话且 submit 回 4001, Then 仍按既有有界重试一次 |
| REQ-015 | high | BFF WS 代理路径已建立 | 角色非 `super_admin` | 上游对 `profiles.list` 的**响应帧**返回全量 profile | **BFF WS 代理** | shall 按调用者 `user_profiles` 白名单**过滤响应**后再下发；**仅对「成功但结构不符」fail-closed**（不下发并回错误）；**上游错误帧（`{id, error}`）shall 原样透传**（不得替换为 BFF 自造错误，见 PR-008）；批帧元素发起的读取 shall 同样被记录并过滤 | Given `admin` 仅分配 `alpha`, When WS 发 `profiles.list{include_sessions:false}`, Then 回包 `profiles[]` 仅含 `alpha`; Given `super_admin`, Then 回包保留全量; Given 上游返回 `{id, error:{code:500,message:"上游错误"}}`, Then **原样透传该错误**; Given 上游返回 `{id, result:{nope:1}}`（结构不符）, Then 不下发全量并回错误（fail-closed） |
| REQ-017 | **critical** | BFF WS 代理路径已建立 | 角色非 `super_admin` | **凡含 `method` 的 request 帧未携带** `params.profile` | **BFF WS 代理** | shall **default-deny**：除命中**显式登记的 profile-agnostic 豁免清单**外，一律注入调用者的 `default_profile` 作为 `params.profile` 后再转发；若调用者无任何已分配 profile 或无 `default_profile` shall 回 `403 PROFILE_FORBIDDEN` 且不转发。**豁免清单**（须在 `design.md` 显式枚举并逐条测试）：`ping` / `gateway.capabilities` / `client.capabilities` / `commands.catalog` / `complete.path` / `complete.slash` / `llm.oneshot`。**禁止**使用「包含式前缀白名单」（如仅 `session.`/`profiles.`/`mcp.`/`skills.`）——遗漏即 fail-open | Given `admin` 分配 `alpha`（default=`alpha`）, When 发 `{method:"session.list",params:{}}`, Then 转发帧 `params.profile === "alpha"`; **Given 发 `{method:"cron.manage",params:{}}`（不在豁免清单）, Then 转发帧 `params.profile === "alpha"`**; **Given 发 `{method:"vault.list",params:{}}`, Then 转发帧 `params.profile === "alpha"`**; Given 发 `{method:"ping",params:{}}`（在豁免清单）, Then **不注入**且正常转发; Given `super_admin`, Then 不注入; Given `admin` 无任何分配 profile, When 发 `session.list`, Then 回 403 且不转发; **Given 遍历 `docs/INTERFACES.md` 的方法清单, Then 每个未被显式豁免的方法都获得注入或 403**（无遗漏） |
| REQ-018 | medium | BFF WS 代理路径已建立 | 上行帧体积较大 | 单帧超过 `maxPayload`，或 `pending` / `outbound` 队列超过**条数上限**，或**累计字节超过字节预算** | **BFF WS 代理** | shall 显式设定 `maxPayload`（同时对**客户端接入侧**与**上游侧**两个 socket 生效）与队列上限（**条数 + 累计字节**，`pendingBytes ≤ K × maxPayload`，K 须量化）；超限 shall 以可读错误拒绝并**只**终止该连接 | Given 单帧超 `maxPayload`, Then 可读错误且仅该连接关闭; Given 队列达条数上限, Then 新帧被拒; **Given `pendingBytes` 达字节预算, Then 新帧被拒（不得无界缓存）**; Given 其他连接, Then 不受影响 |
| REQ-019 | medium | 对话页已挂载 | 前端发起 `model.options` | 加载模型清单 | 模型控件 | shall 携带当前 `profile`（或调用者 `default_profile`）作为 `params.profile`；**若无可用 `profile` shall 不发起请求**并展示可读错误 | Given hero 态加载模型清单, Then `model.options` 参数含非空 `profile`; **Given 无可用 profile, Then 请求数为 0 且展示可读错误** |
| REQ-020 | high | 对话页已挂载 | 用户已显式选择智能体（`selection.profile !== null`） | 发起会话域 RPC（`session.list` / `session.most_recent` / `session.resume` / `session.events.since`） | 会话域请求 | shall 携带 `params.profile = selection.profile`，使多 profile 用户可访问**非默认** profile 的会话；未显式选择时由 BFF 注入 `default_profile`（REQ-017） | Given `admin` 有 `alpha`(default) + `beta` 且 `selection.profile === "beta"`, When 发 `session.list`, Then 帧含 `params.profile === "beta"` 且返回 `beta` 的会话; Given `selection.profile === null`, Then 帧不含 `profile` 并由 BFF 注入 `default_profile`; Given 发 `session.resume{profile:"beta", session_id:<beta 的 stored id>}, Then 成功恢复（不落 `alpha` 存储） |
| REQ-021 | high | BFF 任意路径 | 租户守卫拒绝或响应过滤 fail-closed | 发生上述事件 | BFF | shall 向 `audit` 表写入一条记录（actor / profile / method / ip / 结果 / 时间戳），**shall 不得**写入 token、密钥或文件字节 | Given `admin` 越权 `params.profile`, Then `audit` 表新增一条含 actor、目标 profile、method、结果的记录; Given REQ-015 fail-closed 触发, Then 同样写审计; 断言记录中不含 token/密钥/字节 |
| REQ-016 | medium | 对话页已挂载 | 任意菜单打开（`＋` / 会话头 `···` / 三个 pill / **侧栏会话列表「更多」菜单**） | 键盘交互 | 菜单组件 | shall 符合 WAI-ARIA APG Menu Button：触发元素 `aria-haspopup="menu"` + `aria-expanded`，菜单 `role="menu"`、子项 `role="menuitem"`，`Esc` 关闭并**归还焦点**到触发元素 | Given 菜单打开, Then 触发元素 `aria-expanded="true"`; When 按 `Esc`, Then 菜单关闭且 `document.activeElement` 为触发元素; 断言子项均有 `role="menuitem"`（含侧栏会话列表「更多」菜单） |

**优先级说明**：`REQ-008`/`REQ-015`/`REQ-017`/`REQ-018` 为安全边界（critical/high）；四者**全部落在 Wave 1 同波次交付**（`constitution.md` PR-011），不得跨波次。

## 4. GEARS → GWT 映射

| REQ ID | Given（Where + While） | When | Then |
|--------|-----------------------|------|------|
| REQ-001 | 对话页 + `activeId===null && itemCount===0` | 进入 / 首条消息 | hero 或 docked 结构断言 |
| REQ-002 | 对话页 + hero | 渲染 | pill 选项 = `me.profiles` |
| REQ-003 | 对话页 + 任意态 | 渲染 | 底行控件集合精确匹配，无 voice/branch |
| REQ-004 | 有活动会话 | 点 `···` | 恰 5 项菜单 |
| REQ-005 | 输入区可见 | 点击 / 拖拽 / 粘贴 | chip 生成、零 RPC |
| REQ-006 | hero + chip | 发送 | `create ≺ attach* ≺ submit` 有序 |
| REQ-007 | 已选文件 | >10MB 或 >10 个 | 拒绝 + 可读错误 |
| REQ-008 | 非 super_admin | WS request 帧 `params.profile` 越权 | 同 id 403 `PROFILE_FORBIDDEN`，不转发 |
| REQ-009 | hero / 会话内 | 切模型 | create 参数 / `config.set` |
| REQ-010 | 回合运行中 | 切模型 | `deferred` 提示；回合结束后回正 |
| REQ-011 | 昂贵模型 | 选定 | `confirm_expensive_model` 二次确认 |
| REQ-012 | hero / 会话内 | 选工作区 | `cwd_explicit:true` / `workspace.move`（stored） |
| REQ-013 | 会话内 | 切权限模式 | `config.set yolo scope:"session"` + 失败回滚 |
| REQ-014 | resume 进行中 | 触发 RPC | 本地拦截 |
| REQ-015 | 非 super_admin | `profiles.list` 响应 | 按白名单过滤 |
| REQ-016 | 菜单打开 | 键盘交互 | APG 属性 + Esc 焦点归还 |
| REQ-010a | `deferred` 后收到 `message.complete` | 回合结束 | 调 `model.options{session_id}` 并以 `model` 回正 |
| REQ-011a | hero 态 | 选定模型 | 不弹确认，写 create 参数 |
| REQ-017 | 非 super_admin 发无 `profile` 的 `session.*` 帧 | 转发前 | 注入 `default_profile` |
| REQ-018 | 上行帧/队列超限 | 上限触发 | 可读错误 + 仅终止该连接 |
| REQ-019 | 加载模型清单 | 请求 | 参数含 `profile` |
| REQ-020 | 已选智能体 | 会话域 RPC | 帧携带 `profile` |
| REQ-021 | 守卫拒绝 / 过滤 fail-closed | 事件发生 | 写 `audit` 记录 |

## 5. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | hero 首帧无额外网络请求；选项加载（`model.options` / workspaces / `me`）可并行且每会话 ≤ 1 次（StrictMode 下用 ref 缓存去重）；chip 渲染 P95 < 16ms；10MB 文件编码 shall 仅用**异步** API（`FileReader.readAsDataURL` / `Blob.arrayBuffer`），**禁止**在主线程用 `btoa(String.fromCharCode(...))` 逐字节同步循环；验证方式 = 单元测试以 spy 断言实现调用了异步 API + 代码评审（**真实主线程时序需 e2e，不在 `npm run check` 覆盖**，已登记为不可自动断言项） |
| 可访问性 | 所有 pill / 菜单 / 上传入口有 `aria-label`；菜单符合 APG Menu Button（REQ-016）；拖拽**不得是唯一入口**（WCAG 2.5.7），必须有可聚焦按钮触发文件选择器；隐藏 file input **不得用 `display:none`/`visibility:hidden`**（否则 label 不可键盘访问），须用 visually-hidden（`clip-path: inset(50%)`）并在 `:focus` 时给 label 可见指示；错误用 `role="alert"`（累积型提示用 `role="status"` + `aria-live="polite"`）；文件名字符串可入 DOM 文本，但**文件字节/base64 绝不入 DOM 或日志** |
| 一致性 | 仅用 `--ds-*` token；**圆角一律 `--ds-radius-*`**（代码中不存在 `corner-shape` 超椭圆，属基线漂移，已在 Wave 0 订正）；中文文案；不引 UI 库 |
| 可测性 | 选择/状态逻辑下沉为**纯函数 / reducer**（`useSessionControls`、`pendingAttachments`、`deriveComposerVariant`、normalizers），组件仅做渲染 |
| 安全 | 前端零 token；文件字节与 base64 **绝不进日志**；WS 守卫复用 `userCanAccessProfile` 语义且 **fail-closed**（仅在明确判定越权时拦截，无法解析的帧保持旧行为并记录） |
| 兼容 | React 19 `StrictMode` 双调用下 hero↔docked 与上传流程**幂等**；`previewUrl`（`URL.createObjectURL`）在 4 个时机恰好 revoke 一次 |

## 6. 属性测试属性

| REQ | Property | Invariant | Edge Cases |
|-----|----------|-----------|------------|
| REQ-001 | hero 显示 ⟺ `activeId===null && itemCount===0` | hero 与 docked 互斥且穷尽 | empty、单条、切会话中间态、StrictMode 双渲染 |
| REQ-002 | pill 选项集合恒等于 `me.profiles` 白名单 | 不回退到 `profiles.list` 全量 | null / 缺字段、空数组、重复项 |
| REQ-003 | 底行控件集合为常量 | 永不含 voice / git | 窄屏、侧栏折叠、运行中（发送↔停止） |
| REQ-004 | 菜单项集合恒为 5 项 | 重命名恒用 runtimeId | 无活动会话时菜单不渲染 |
| REQ-005 | 确认发送前 RPC 调用数恒为 0 | 延迟绑定不可被绕过 | 0 文件、批量、同名、粘贴无图片项 |
| REQ-006 | 成功发送的调用序恒满足 `create ≺ attach* ≺ submit`；发送进行中恒只有一次 `create` | attach 全成功才 submit；single-flight | attach 部分失败、create 失败、chip 为空、**并发双击发送（须恒为 1 次 create）** |
| REQ-007 | 入 chip 者恒 `size ≤ 10MB` 且单批 ≤ 10 | 上限不可绕过 | 恰好 10MB、10MB+1B、0 字节、第 11 个、超限混入合法 |
| REQ-008 | 放行 ⟺ request 帧且 (`super_admin ∨ assigned`) 或帧不含 `profile` | 守卫与 REST 同语义，响应帧恒放行 | profile 缺失、空串、super_admin、多 profile、数组批帧 |
| REQ-009 | hero 路径恒不产生 `config.set`；会话路径恒带 `session_id = runtimeId` | 两级语义不混用 | 无 session、身份未就绪、连续切换 |
| REQ-010 | `running=true` 时切换恒不热切；`deferred` 后收到 `message.complete` 恒触发一次 `model.options{session_id}` 回正 | UI 最终与网关 `model` 一致；不一致须回滚并提示 | deferred 后又被覆盖、turn start 丢弃 stash（回包 `model` ≠ 选择）、interrupt 后切换 |
| REQ-011 | 前端恒不预判「昂贵」；未回 `confirm_required` 前恒不弹确认；未确认恒不落库 | 以网关 `confirm_required` 为唯一判据 | `confirm_required` 后取消、连续两次选同一昂贵模型、回包无 `confirm_message` |
| REQ-012 | hero 恒「选了目录才 `cwd_explicit:true`」；会话内恒 `session_key = storedId` | 身份键不可互换 | 空 cwd、未选目录（省略字段）、相对路径、切会话后沿用旧 cwd |
| REQ-013 | 权限变更失败时 UI 选中态 = 变更前 | 无乐观残留 | 回包 error、scope 缺省、连续切换 |
| REQ-014 | `activeId === null` 时恒**不**拦截发送；`activeId !== null` 且身份未就绪时恒 0 条 runtime-id RPC 外发 | hero 发送与身份守卫不冲突；4001 有界重试不变 | hero 发送、resume 中、resume 失败、快速切行 |
| REQ-015 | 非 super_admin 收到的 profiles[] ⊆ 白名单；「成功但结构不符」恒 fail-closed；上游错误帧恒原样透传 | 无 fail-open、且不违反错误透传 | 空白名单、profile 名重复、响应非 JSON、响应缺 profiles 键、上游错误帧、super_admin |
| REQ-016 | 菜单打开 ⟺ `aria-expanded="true"`；关闭后焦点 = 触发元素 | 焦点不丢失到 body | 无 `menuitem`、快速连开、Esc 冒泡与 slash/@ 菜单冲突 |
| REQ-010a | `deferred` 状态下收到 `message.complete` 恒恰好触发 1 次 `model.options{session_id: runtimeId}` | 回正不可重复触发 | 同一回合多次 `message.complete`、无 `deferred` 时不触发、session_id 为空 |
| REQ-017 | 非 `super_admin` 且帧 `method` 前缀命中白名单时，转发帧恒含 `params.profile = default_profile` | 租户上下文由服务端固定 | 已带 `profile`（不覆盖）、无任何分配 profile（403）、super_admin（不注入）、default_profile 为空 |
| REQ-018 | 任何超过上限的上行帧恒被拒且不影响其他连接 | 队列不无界增长 | 恰好等于上限、超上限 1 字节、队列满、并发连接 |
| REQ-019 | `model.options` 参数恒含非空 `profile` | 不发起无租户上下文的请求 | hero 态、无 default_profile |

## 7. 边界（Always / Ask First / Never）

| 级别 | 边界 | 规则 |
|------|------|------|
| ✅ Always | 会话域 RPC 前校验 `identityReady` | 身份未就绪一律不发 runtime-id RPC（REQ-014） |
| ✅ Always | `workspace.move` 用 stored id；`title` / `interrupt` / `attach*` / `config.set(session_id)` 用 runtime id | 身份键成对使用，归一化失败即报错 |
| ✅ Always | 上游/网关错误 message 原样透传 | 不吞错、不替换为泛化文案（REQ-006） |
| ✅ Always | 上传经浏览器 API（File / Clipboard / DnD） | `clipboard.paste` / `input.detect_drop` 是宿主侧，禁用 |
| ✅ Always | 仅用 `--ds-*` token 手写 CSS，圆角用 `--ds-radius-*` | 不引 UI 库 |
| ✅ Always | 拖拽之外必须提供可聚焦的文件选择按钮 | WCAG 2.5.7 |
| ✅ Always | WS 守卫 **default-deny**：凡含 `method` 字符串的帧一律按 request 守卫；数组批帧逐元素；二进制帧与 JSON 解析失败一律拒绝 | 不得以「通知/响应/无法解析」名义放行（REQ-008） |
| ✅ Always | 非 `super_admin` 的 `session.*` / `profiles.*` / `mcp.*` / `skills.*` 帧必带租户上下文 | 缺失时由 BFF 注入 `default_profile`（REQ-017） |
| ✅ Always | 响应过滤失败时 fail-closed | 绝不下发未过滤的全量（REQ-015） |
| ❓ Ask First | 单次上传数上限 / 拖拽文件夹（**已定**） | ≤10 个、只取顶层不递归 |
| ❓ Ask First | `分享` 目标形态（**已定**） | 沿用现有链接 + 剪贴板 |
| ❓ Ask First | 会话内切智能体（**已定**） | 强开新会话，pill 只读 |
| ❓ Ask First | WS 大 payload 降级（**已定**） | 10MB 不分片、>2MB 等待态、失败复用 identity |
| ❓ Ask First | 服务端 magic bytes 校验落点（Hermes 还是 BFF） | 见风险 R10，需实测后定 |
| ❓ Ask First | `···` 菜单「连接」的确切语义（多实例切换 vs 状态展示） | 需产品确认落点 |
| ❓ Ask First | hero 态选昂贵模型无二次确认（`session.create` 无 `confirm_expensive_model` 字段） | 见 R13；需产品确认是否可接受 |
| ❓ Ask First | REQ-017 的 `method` 前缀白名单是否完备（`session.`/`profiles.`/`mcp.`/`skills.`） | 见 R14，需以官方方法清单核对 |
| 🚫 Never | 前端持有 Hermes token 或回显密钥 | 红线（`AGENTS.md §8`） |
| 🚫 Never | 把文件字节 / base64 写入日志或 DOM 文本 | 红线 |
| 🚫 Never | hero 态因上传而调用 `session.create` 等 RPC | 破坏延迟绑定（REQ-005） |
| 🚫 Never | 回合运行中强行热切模型（绕过 `pending_model_switch`） | 破坏网关契约（REQ-010） |
| 🚫 Never | 在 WS 代理路径跳过 profile 守卫 | 安全缺口（REQ-008，critical） |
| 🚫 Never | 用 `image.attach{path}` 传浏览器本地文件 | 浏览器无网关可见路径（REQ-006） |
| 🚫 Never | 在 WS 守卫中拦截含 `result`/`error` 的响应帧 | 会打断审批/secret/sudo 回包（REQ-008） |
| 🚫 Never | 以「缺少 `id`」或「存在 `result`/`error`」为由把含 `method` 的帧放行 | 这是 CRITICAL 绕过路径（REQ-008） |
| 🚫 Never | 透传二进制帧或无法解析的帧而不拒绝 | 同属绕过路径（REQ-008） |
| 🚫 Never | 在 `activeId === null`（hero 态）禁用发送 | 会破坏 REQ-001/006（N-013） |

## 8. 契约依据（官方源码）

源码根：`/vol1/@apphome/trim.openclaw/data/home/hermes-desktop/home/hermes-agent/tui_gateway/`

| 事实 | 依据 |
|------|------|
| `ProfileParams{profile?}` / `SessionParams{session_id, profile?}` | `contracts/common.py:221-231` |
| `SessionCreateParams(ProfileParams)` 含 `cwd` / `cwd_explicit` / `model` / `provider` / `reasoning_effort` / `fast` / `title`；`cwd_explicit` doc：「true only for a deliberate workspace pick」 | `contracts/sessions.py:118-147` |
| `session.resume` 入参 = stored id，回包 `session_id` = runtime id | `contracts/sessions.py:174-191` |
| `session.workspace.move{session_key(stored), cwd}` / `session.cwd.set{session_id(runtime), cwd}` | `contracts/sessions.py:326-349` |
| `ConfigSetParams{key, value, session_id?, scope?, confirm_expensive_model}` | `contracts/config_free_tier_control.py:74-107` |
| 运行中模型切换改为 stash 到下一回合，回 `deferred:true`；未确认 stash 在 turn start 被丢弃 | `methods_config_set.py:73-91` |
| `model.options{session_id?, explicit_only, include_unconfigured, refresh}` → `{providers[], model, provider}`，provider 含 `capabilities{fast, reasoning}` / `pricing` / `authenticated` | `contracts/config_free_tier_control.py:216-280` |
| `image.attach_bytes{content_base64\|data, filename?, ext?}` | `contracts/prompt_voice.py:120-131` |
| `file.attach{path?\|data_url?\|name?}` → `{ref_path, ref_text, uploaded}` | `contracts/prompt_voice.py:164-183` |
| `pdf.attach{path?\|content_base64?\|data?, filename?, first_page?, last_page?}` → PNG 页 | `contracts/prompt_voice.py:134-161` |
| `clipboard.paste{}` = **宿主**剪贴板（浏览器不可用） | `contracts/prompt_voice.py:104-109` |
| `input.detect_drop{text}` = 仅识别**终端**拖拽文本（浏览器不可用） | `contracts/prompt_voice.py:199-215` |
| **不存在 `session.info`**；`session.status` 回包仅 `{output: str}`（渲染文本），**不可**用于模型对齐 | `contracts/sessions.py:431-440` |
| 模型对齐唯一结构化来源：`model.options{session_id}` 回包的 `model` / `provider` | `contracts/config_free_tier_control.py:273-277`（doc: "layered over the session's live provider when given"） |
| `message.complete` 事件（回合结束）可作为对齐触发器 | `contracts/events.py:205` |
| 运行中 stash 的开关在 **turn start** 被应用/丢弃 | `prompt_turn.py:622`；`session_compression.py:198-206` |
| `profiles.list` 不按调用者过滤 → 全量返回 | `methods_profiles.py:266-285` |
| 帧含 `method` 但无 `id` 的「通知」—— 不得据此放行 | 本 Spec REQ-008（default-deny）；评审证据见 §9 R13 |

## 9. 风险

| # | 风险 | 影响 | 缓解 |
|---|------|------|------|
| R1 | 运行中切模型的 `deferred` 与用户预期差；stash 可能在 turn start 被丢弃（`prompt_turn.py:622`） | 困惑、误报 bug | **已由 REQ-010a 闭合**：`message.complete` 后调 `model.options{session_id}` 回正；不一致则回滚并提示「切换未生效」；属性测试覆盖「回包 `model` ≠ 选择」 |
| R2 | `cwd_explicit` 与具名 profile `terminal.cwd` 的优先级 | 会话跑错目录 | 仅显式选目录时置 `cwd_explicit:true`；未选则**省略字段**；单测断言两种入参 |
| R3 | base64 经 WS 的体积/超时（10MB → ≈13.3MB 单帧）；`ws` 库默认 `maxPayload` 与上游上限均**未实测** | 上传失败、连接断开 | A4：不分片、>2MB 等待态、失败复用 identity；建议给 BFF 显式设 `maxPayload`；`proxy.ts:33-46` 的 `pending`/`outbound` 数组会放大内存，需上限 |
| R4 | WS profile 守卫可能误伤既有调用 | 智能体页/列表回归 | 守卫仅在 request 帧且 `params.profile` 非空且越权时拦截；响应帧/通知帧/无 profile 帧放行；专项回归测试 `profiles.list` |
| R5 | 会话内切 profile 导致上下文/工作区语义混乱 | 数据串会话 | A1：强开新会话 |
| R6 | 拖拽/粘贴与 slash / `@` 菜单焦点冲突 | 键盘不可达 | 统一 focus 管理与 Esc 冒泡策略（REQ-016） |
| R7 | 基线漂移（`requirement.md` / `ui-spec.md` / `docs/TASKS.md:102` / 「corner-shape」四处） | 后续任务反复 | Wave 0 先改 4 份基线 + `task-list.md`，Wave 5 收口复核 |
| R8 | 昂贵模型确认与 deferred 叠加（运行中 + 昂贵） | 状态机分支爆炸 | `useSessionControls` 纯 reducer + 属性测试组合态（REQ-010×011） |
| R9 | 现有附件实现向 attach RPC 传 `{name,size,type}`，网关很可能报错；改为延迟绑定会破坏既有测试断言（`ChatPage.test.tsx:369-384`） | 既有测试需同步改 | Wave 2/4 同步改测试；新增「hero 零 RPC」专测 |
| R10 | **服务端 magic bytes 校验落点未定**（Hermes 还是 BFF）；OWASP File Upload 要求服务端校验，而 `File.type` 仅客户端声明 | 伪造文件可绕过 | 实测网关行为；若网关不做，BFF 补校验（独立任务，避免本 Spec 膨胀）；客户端 `File.type` 仅作 UX 预筛 |
| R11 | 规范偏差记录：OWASP 建议 WS 消息 ≤64KB，本 Spec 选 10MB 单帧 | 评审争议 | 在 `architecture.md` 显式登记偏差与补偿控制（A4 + 等待态 + 上限 + 实测） |
| R12 | `ws.ts` 原有错误解析只读 `error.code`(number) + `message`，读不到 `PROFILE_FORBIDDEN` 字符串 | REQ-008 无法断言命名错误码 | 已定：扩展 `ws.ts` 读取 `error.data.code`（约 5 行） |
| R13 | **帧分类 fail-open（CRITICAL，评审发现）**：原设计以「无 `id` = 通知」「带 `result`/`error` = 响应」「数组/二进制 = 放行」为免拦理由，形成 4 条可复现绕过 | 完全击穿 REQ-008 与 N-005 | **已由 REQ-008 的 default-deny 改写闭合**：凡含 `method` 即守卫、数组逐元素、二进制与解析失败一律拒绝；`constitution.md` A-006 同步改写 |
| R14 | REQ-017 的 `method` 前缀白名单可能不完备（漏掉其他租户作用域方法） | 残余越权 | 以官方方法清单（`contracts/*.py` 的全部 `method(...)`）核对；列为本 Spec 的「已知未闭合项」，实测后补 |
| R15 | 10MB 端到端可达性未实测（`ws` 的 `maxPayload`、上游上限、BFF 队列内存放大） | 上传失败 | **已由 REQ-018 部分闭合**（显式上限 + 队列上限）；端到端值以实测为准，REQ-007 只承诺**前端预筛** 10MB，网关拒绝则透传 message；列入 e2e/实测任务 |
| R16 | 「昂贵」判定依据（`pricing` vs `authenticated`）与 hero 路径无确认 | 计费意外 / 需求不可验收 | **已由 REQ-011 改写闭合**（前端不预判、以网关 `confirm_required` 为唯一判据）；hero 路径无确认列为 R13'（见 Ask First）——**已是本表 R13'，即 `REQ-011a` + Ask First 两条** |
| R17 | 契约源码路径 `/vol1/.../hermes-desktop/...` 不在本仓库，判定不可被 CI 独立复核 | 安全判据建立于外部事实 | 新增任务：把可核验的契约片段归档到本 Spec 目录（`contracts-evidence.md`） |

## 10. 已知未闭合项

| 项 | 说明 | 处置 |
|---|---|---|
| `params.profile` 维度越权 | 帧分类曾有 4 条绕过 | **REQ-008 闭合**（default-deny） |
| `profiles.list` 元数据枚举 | 不按调用者过滤 | **REQ-015 闭合**（过滤 + fail-closed） |
| **会话 ID 维度越权** | `session.list/resume/events.since` 无 `profile` → 落启动 profile 存储 | **REQ-017 闭合**（注入 `default_profile`） |
| REQ-017 白名单完备性 | 前缀清单是否漏方法 | **未闭合**（R14）；须以官方 `method(...)` 全清单核对 |
| 服务端 magic bytes 校验 | 落点未定 | **未闭合**（R10），独立任务 |
| WS 大帧端到端可达性 | `maxPayload` / 上游上限未实测 | 部分闭合（REQ-018 显式上限）；端到端待实测（R15） |
| hero 态昂贵模型无二次确认 | `session.create` 无该字段 | **未闭合**（REQ-011a / Ask First） |
| 「连接」菜单语义 | 产品未定 | `❓Ask First` |
| `/api/auth/me` 是否返回头像 | 决定 AgentPicker 是否只用首字占位 | 实现阶段验证 |
| 契约片段不可 CI 复核 | 源码在仓库外 | R17；归档任务 |

## 11. 基线同步要求（红线 `AGENTS.md §11`）

变更须先改 4 份基线文档，再更新 `task-list.md`，最后才改代码：

| 文件 | 修改要点 |
|---|---|
| `AGENTS.md` | §4 补「智能体 = Hermes profile，选项取 `me.profiles[]`，会话内切智能体强开新会话」；§5 补「WS 租户守卫」；§9 目录表新增 `apps/web/src/chat/composer/` |
| `requirement.md` | §3 「对话」行改为双态 + 字段精简版控件 + 本会话模型覆盖 + 上传三通道；明确不做语音与 git 分支 pill |
| `ui-spec.md` | §1/§2/§3 补 hero/docked 双态、3 pill、底行控件、`···` 菜单；**删除不存在的「corner-shape 超椭圆」表述**，改为 `--ds-radius-*` |
| `architecture.md` | 新增节：两级模型语义 + WS 租户守卫（帧分类判据 + 同 id 拒绝）+ 10MB 规范偏差与补偿控制 |
| `docs/TASKS.md` | 订正 `T8.2`（落点：设置=全局默认；对话页=本会话覆盖）；`T4.4` 补 profile 守卫；`T6.11` 明确延迟绑定与 `attach_bytes` |
| `task-list.md` | 订正 `T8.2`/`T4.4` 描述；新增 M17 段（本 Spec 任务），作为唯一「下一步」入口 |
