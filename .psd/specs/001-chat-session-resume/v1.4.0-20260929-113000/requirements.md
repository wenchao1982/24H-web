# Bugfix Specification: 会话身份（stored id / runtime id）与历史会话 resume
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix | Version: v1.4.0-20260929-113000 | Parent: v1.3.0
> 最终规格：并入第 4 轮对抗性评审全部 7 项（0 CRITICAL）。

## 1. 业务背景
真机测试 24H Web 对话报错：
`tui_gateway.server: session-scoped RPC rejected: method=prompt.submit session_id='20260928_102322_7f04bb' not in memory (detached/reaped runtime; client should resume the stored session), rid=24`

用户点选历史会话后发送消息被网关拒绝，界面无助手输出。BFF 为透明管道，无责；缺陷在前端 `apps/web`。

## 2. 契约事实（官方源码，均为证据）
| RPC | 身份键 | 证据 |
| --- | --- | --- |
| `session.resume` | 入参 = **stored id**；回包 `session_id` = **runtime id** | `tui_gateway/contracts/sessions.py:174-191` |
| `session.create` | 回包含 `session_id`(**runtime**) 与 `stored_session_id`(**stored**)，两字段独立 | `contracts/sessions.py:138-143` |
| runtime id 形态 | `uuid.uuid4().hex[:8]`（与 stored 时间戳 id 天然不同 ⇒ **R≠S 由服务端保证**） | `methods_session.py:65-67` |
| `session.list` | 行 `id` = **stored id** | `methods_session.py:118-124` |
| `prompt.submit` | **runtime id** | `methods_prompt.py:585` → `server.py:1167-1183 _sess_nowait` |
| `session.interrupt` | **runtime id** | `methods_session.py:2146-2149` |
| `session.title` | **runtime id** | `methods_session.py:1096-1097` |
| `file.attach` / `image.attach` / `image.attach_bytes` / `pdf.attach` / `clipboard.paste` | **runtime id** | `methods_prompt.py:845-849 / 728-730 / 756 / 787-794 / 704-706`（均 `_sess_building`→`_sess_nowait`） |
| `subagent.list` / `delegation.status` | **runtime id** | `methods_subagents.py:53-58`；调用点 `SubagentsPanel.tsx:29,31` |
| `session.events.since` | **runtime id**（回放 ring 键） | `server.py:665-668` + `event_replay.py:57` |
| `session.delete` | **stored id**（DB 键） | `methods_session.py:1055-1064` |
| `session.workspace.move` | **stored id，字段名 `session_key`（非 `session_id`）** | `methods_session.py:987-992` |
| 错误结构 / 4001 | `{code,message,data?}` / 未知 runtime id | `server.py:848-850` / `server.py:1167-1183` |

## 3. 当前行为 (Current Behavior)
- 点选历史会话 S：仅 `setActiveId(S)`+清空，**从不 resume**（`ChatPage.tsx:300-303`）。
- 发送消息：以 S 调 `prompt.submit` → 4001（`ChatPage.tsx:371-394`）。
- 收到 4001：通用「发送失败」，无恢复（`ChatPage.tsx:388-391`）。
- 网关回 `message.delta`：以 S 比对 runtime id → 全丢弃（`ChatPage.tsx:158`；`types.ts:132-135` 缺 id 时 fail-open）。
- 「恢复」菜单：`resumeSession` 丢弃 runtime id、不 attach、不改 identity（`ChatPage.tsx:332-343,597`；`SessionList.tsx:156`）。
- 重命名：`session.title` 用活动存储 id（`ChatPage.tsx:308,597`）→ 实为 runtime RPC → 4001，且非活动行会被误改。
- 移动工作区：发 `{session_id, workspace}`（`ChatPage.tsx:515-517`）→ 应 `session_key` → 真机 4007。
- `subagent.list`：以 stored id 调（`SubagentsPanel.tsx:29`）→ 需 runtime id。
- 新建会话：只取 `session_id` 当 stored（`ChatPage.tsx:281-298`、`types.ts:114-120`）→ delete/workspace.move 将拿到 runtime id。
- `?session=` 深链：不 attach（`ChatPage.tsx:269-279`）。
- 判 4001：`ws.ts:85-88` 丢弃 `error.code`。

## 4. 期望行为 (Expected Behavior)
- 身份对 `SessionIdentity = { storedId, runtimeId }`；`runtimeId` **仅来自 resume/create 回包**（客户端从不以列表 id 充当 runtime id）。
- 任何 runtime-id RPC 发出前：`identity != null && identity.storedId === activeId`。
- 点选/深链：同步清空 identity 后 resume；归一化失败报错；`normalizeResumedId` **只接受 `session_id`**。
- `session.create`：`storedId = stored_session_id`，`runtimeId = session_id`；零 resume。
- 逐行操作：重命名为**目标行**取 runtime id（目标即活动时复用现身份，不重 resume）；删除用目标 stored id；均不得改写活动身份。
- 「恢复」菜单 == 点选路径。
- 事件匹配接受 `session_id` 或 `sessionId`；无可辨识 id 的终止事件（`done`/`error`）仅清除 running，不追加内容。
- 4001 → 以发送时 captured storedId 有界重试一次。
- 错误透传网关 message。

## 5. 不变行为 (Unchanged Behavior) — 附证据
- `session.list`（stored id 列表）、`session.delete`（stored id）不变（§2）。
- `session.resume` 的**入参仍为 stored id**（不得改成 runtime id）。
- BFF `/api/hermes/ws` 透明；BFF 无需改动。
- 非会话域 RPC（`commands.catalog`/`complete.slash`/`profiles.*`）不受影响。

## 6. 根因 (Root Cause)
| 编号 | 位置 | 描述 |
| --- | --- | --- |
| A | `ChatPage.tsx:300-303` | `selectSession` 不 resume |
| B | `ChatPage.tsx:332-343,597`+`SessionList.tsx:156` | `resumeSession` 丢弃 runtime id、不改 identity |
| C | `ChatPage.tsx:388-391` | `handleSend` 吞 4001 |
| D | `ChatPage.tsx:158`+`types.ts:132-135` | 事件过滤用 stored id 且 fail-open |
| E | `ws.ts:85-88` | 丢弃 `error.code` |
| F3 | `ChatPage.tsx:308` | `session.title` 用 stored id 且误改非活动行 |
| F4 | `ChatPage.tsx:515-517` | `workspace.move` 误用 `session_id` |
| F5 | `SubagentsPanel.tsx:29` | `subagent.list` 用 stored id |
| F6 | `ChatPage.tsx:269-279` | 深链不 attach |
| F7 | `ChatPage.tsx:281-298`+`types.ts:114-120` | create 未区分 `session_id`/`stored_session_id` |
| F8 | v1.2.0 design | `normalizeResumedId ?? id` fail-open（已移除） |

## 7. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | high | - | - | 用户点选或深链进入存储会话 S | chat page | 同步清空身份后以 stored id resume，仅在取得回包 runtime id 且 S 仍选中时提交身份对 | Given 列表含 S, When 点击 S, Then identity 先置 null；成功后为 `{storedId:S, runtimeId:R}`（R 取自回包、非列表 id）；归一化失败则 identity 为 null 并报错 |
| REQ-002 | high | - | 会话已 attach | 发起 session-scoped RPC 或收到会话事件 | chat page | 按 §2 矩阵使用正确身份键 | Given 身份对(S,R), When submit/interrupt/title/file/image/pdf/clipboard.attach/subagent.list/events.since, Then `session_id`=R；`workspace.move` 用 `session_key:S`；`delete` 用 S；`resume` 入参用 S |
| REQ-003 | high | - | 会话已 attach | 某 runtime-id RPC 返回 4001 | chat page | 以发送时 captured stored id 重新 resume 并重试恰好一次 | Given `prompt.submit` 首次 4001, When 重试, Then 用**发送时** S resume 后重发一次；仅重试失败才提示 |
| REQ-004 | medium | - | - | resume/RPC 失败 | chat page | 透传网关真实错误信息 | Given 失败消息 M, Then 显示 M |
| REQ-005 | high | - | 用户可在 resume 未返回时切换会话 | 迟到 resume/create 响应或跨会话读取 | chat page | 仅当 `identity.storedId === activeId` 时才提交/使用，否则丢弃 | Given 选中 A 未等响应即切 B, When A 响应到达, Then identity 仍属 B |
| REQ-006 | high | - | - | 用户新建会话 | chat page | 以回包 `stored_session_id` 作 storedId、`session_id` 作 runtimeId，零 resume | Given create 返回 `{session_id:R, stored_session_id:S}`, Then identity=`{S,R}`、列表项 id=S，`session.resume` 调用为 0 |
| REQ-007 | high | - | - | 通过 `?session=` 深链进入 | chat page | 与点选一致地 attach | Given `?session=S` 且列表含 S, Then 触发一次 `session.resume{session_id:S}` |
| REQ-008 | low | - | - | （可选 F2）展示往期消息 | chat page | 可渲染历史消息 | Given resume 回包含 messages, When 选中会话, Then 显示往期消息（Ask First） |
| REQ-009 | high | - | 存在活动会话 A | 用户对目标行 T 执行重命名/删除 | chat page | 重命名用 T 的 runtime id（T 即 A 时复用现身份；否则按 T 临时 resume），删除用 T 的 storedId；均不得改写活动身份 | Given 活动 A、目标 T, When 重命名 T, Then `session.title{session_id: T 的 runtime}`；若 T=A 则复用现 runtime 且不重 resume；When 删除 T, Then `session.delete{session_id:T}` |
| REQ-010 | high | - | - | 用户触发「恢复」菜单 | chat page | 走与点选相同的 attach 路径 | Given 对 T 触发恢复, Then 与 `selectSession(T)` 行为一致 |
| REQ-011 | medium | - | 存在运行中的 turn | 收到无可辨识 `session_id`/`sessionId` 的终止事件 | chat page | 清除 running，不追加内容 | Given `done`/`error` 无 id, Then `running=false` 且 transcript 不新增内容 |

## 8. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 点选即 resume | When 点击 S | 断言 resume 参数/次数 |
| R 取自回包 | Given resume 回包 | 断言 R 来自回包；fixture 用 R≠S 以捕获 fail-open |
| 矩阵身份 | When 各 RPC | 断言 `session_id`/`session_key` |
| 4001 有界恢复 | When 首次 4001 | 断言发送时 S resume + 一次重试 |
| 乱序守卫 | When A 迟到 | 断言 identity 不被覆盖 |
| create 双字段 | Given create 回包 | 断言 identity 与列表项 id |
| 逐行隔离 | Given 活动 A、目标 T | 断言 T 身份且 identity 仍为 A；T=A 时不重 resume |
| 无可辨识终止事件 | Given done 无 id | 断言 running=false 且无新内容 |

## 9. 非功能需求
- NFR-001: resume 不因渲染重复触发；同 id 并发 attach 去重。
- NFR-002: 4001 自动恢复最多一次；resume 自身 4001 不递归。
- NFR-003: TypeScript strict 无 `any` 泄漏；`npm run check` 全绿。

## 10. 属性测试 (Property-Based Tests)
1. **身份来源不变量（限 runtime-id RPC）**：任意 runtime-id RPC 发出前必存在 `{S,R}`，R 非空且取自 resume/create 回包；客户端从不以列表 id 直接充当 R。（测试 fixture 使用 R≠S 以捕获 fail-open；客户端不强制 R≠S——该性质由服务端保证，见 `methods_session.py:65-67`。）
2. **有界恢复**：仅首次 4001 时追加一次 resume + 一次重试；重试失败不再重试；resume 自身 4001 不递归。
3. **create 无回归**：首个 `prompt.submit` 用回包 `session_id`；`session.resume` 调用为 0；列表项 id == `stored_session_id`。
4. **乱序安全**：任意切换时序下，迟到响应（含 create）不改变当前身份对。
5. **身份一致性**：所有会话事件 `session_id`（或 `sessionId`）与事件回放所用 id 相同（runtime）。
6. **会话隔离**：任意时刻发出的 runtime-id RPC，其 `session_id` 属于当前选中会话。
7. **create 双 id**：`normalizeCreatedIdentity` 对缺任一字段的回应返回 null。
8. **逐行操作隔离**：对非活动目标 T 的重命名/删除不改写 identity、不对活动会话发 RPC；对 T===A 的重命名复用现 runtime，不触发额外 resume。
9. **终止事件兜底**：无 id 的 `done`/`error` 清 running 且不产生内容。

## 11. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 用身份对寻址；提交前同步清空；严格事件过滤（含 camelCase 回退）；错误透传；并发 attach 去重 |
| ❓ Ask First | `session.resume` 的 lazy/defer_history/omit_messages；历史消息渲染；新增依赖 |
| 🚫 Never Do | 归一化失败回退 stored id；`normalizeResumedId` 接受 `id`；以列表 id 充当 runtime id；用 stored id 调 runtime-id RPC；向非当前会话的 runtime id 发 RPC；逐行操作改写当前 identity；无限重试；改 BFF 语义；猜未验证 schema |
