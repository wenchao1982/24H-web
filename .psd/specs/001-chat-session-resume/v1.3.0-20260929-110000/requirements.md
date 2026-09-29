# Bugfix Specification: 会话身份（stored id / runtime id）与历史会话 resume
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix | Version: v1.3.0-20260929-110000 | Parent: v1.2.0
> 本版修正 v1.2.0 对抗性评审的第 3 轮发现（1 CRITICAL + 2 HIGH + 2 MEDIUM + 1 LOW）。

## 1. 业务背景
真机测试 24H Web 对话报错：
`tui_gateway.server: session-scoped RPC rejected: method=prompt.submit session_id='20260928_102322_7f04bb' not in memory (detached/reaped runtime; client should resume the stored session), rid=24`

用户点选历史会话后发送消息被网关拒绝，界面无助手输出。BFF 为透明管道，无责；缺陷在前端 `apps/web`。

## 2. 契约事实（官方源码，均为证据）
| RPC | 身份键 | 证据 |
| --- | --- | --- |
| `session.resume` | 入参 = **stored id**；回包 `session_id` = **runtime id** | `tui_gateway/contracts/sessions.py:174-191` |
| `session.create` | 回包同时含 `session_id`(**runtime**) 与 `stored_session_id`(**stored**) | `contracts/sessions.py:138-143` |
| `session.list` | 行 `id` = **stored id** | `methods_session.py:118-124` |
| `prompt.submit` | **runtime id** | `methods_prompt.py:585` → `server.py:1167-1183 _sess_nowait` |
| `session.interrupt` | **runtime id** | `methods_session.py:2146-2149` |
| `session.title`（含重命名） | **runtime id** | `methods_session.py:1096-1097`（`_with_db(session_scoped=True)`→`_sess_nowait`） |
| `file.attach` | **runtime id** | `methods_prompt.py:845-849` |
| `subagent.list` / `delegation.status` | **runtime id** | `methods_subagents.py:53-58`；调用点 `SubagentsPanel.tsx:29,31` |
| `session.events.since` | **runtime id**（回放 ring 键） | `server.py:665-668` + `event_replay.py:57` |
| `session.delete` | **stored id**（DB 键） | `methods_session.py:1055-1064` |
| `session.workspace.move` | **stored id，但字段名 `session_key`（非 `session_id`）** | `methods_session.py:987-992` |
| 错误结构 / 4001 | `{code,message,data?}` / 未知 runtime id | `server.py:848-850` / `server.py:1167-1183` |

## 3. 当前行为 (Current Behavior)
- When 点选历史会话 S，Then 仅 `setActiveId(S)`+清空，**从不 resume**（`ChatPage.tsx:300-303`）。
- When 发送消息，Then 以 S 调 `prompt.submit` → 4001（`ChatPage.tsx:371-394`）。
- When 收到 4001，Then 通用「发送失败」，无恢复（`ChatPage.tsx:388-391`）。
- When 网关回 `message.delta`，Then 以 S 比对 runtime id → 全丢弃（`ChatPage.tsx:158`；`types.ts:132-135` 缺 `session_id` 时 fail-open）。
- When 用「恢复」菜单，Then `resumeSession` 丢弃 runtime id 且不清空/不改 identity（`ChatPage.tsx:332-343,597`；`SessionList.tsx:156`）。
- When 重命名非活动行，Then `session.title` 用活动存储 id（`ChatPage.tsx:308,597`）→ 实为 runtime RPC → 4001 且会误改活动会话。
- When 移动工作区，Then 发 `{session_id, workspace}`（`ChatPage.tsx:515-517`）→ 官方要 `session_key` → 真机 4007。
- When `subagent.list`，Then 以 stored id 调（`SubagentsPanel.tsx:29`，由 `ChatPage.tsx` 传 `activeId`）→ 需 runtime id。
- When 新建会话，Then `normalizeCreatedId` 只取 `session_id` 并把它当 stored（`ChatPage.tsx:281-298`、`types.ts:114-120`）→ 后续 delete/workspace.move 会拿到 runtime id。
- When `?session=` 深链进入，Then 不 attach（`ChatPage.tsx:269-279`）。
- When 判 4001，Then `ws.ts:85-88` 丢弃 `error.code`。

## 4. 期望行为 (Expected Behavior)
- 身份建模为成对结构 `SessionIdentity = { storedId, runtimeId }`。
- 任何 runtime-id RPC 发出前必须满足 `identity != null && identity.storedId === activeId`。
- 点选/深链：**同步清空 identity** 后 resume；归一化失败报错，**不得回退 stored id**，且 `normalizeResumedId` **只接受 `session_id`**（不得 `?? id`）。
- `session.create`：用回包 `stored_session_id` 作 storedId、`session_id` 作 runtimeId；零 resume。
- 逐行操作：重命名按**目标行** storedId 临时取 runtime id（不改变当前活动会话）；删除用目标 storedId。
- 「恢复」菜单等价于点选（同一 attach 路径）。
- 事件严格匹配 runtime id（缺 `session_id` 不放行）。
- 4001 → 以**发送时** captured storedId 有界重试一次。
- 错误透传网关 message。

## 5. 不变行为 (Unchanged Behavior) — 均附证据
- `session.list`（stored id 列表）、`session.delete`（stored id）行为不变（§2）。
- BFF `/api/hermes/ws` 透明；BFF 无需改动。
- 非会话域 RPC（`commands.catalog`/`complete.slash`/`profiles.*`）不受影响。

## 6. 根因 (Root Cause)
| 编号 | 位置 | 描述 |
| --- | --- | --- |
| A | `ChatPage.tsx:300-303` | `selectSession` 不 resume |
| B | `ChatPage.tsx:332-343,597` + `SessionList.tsx:156` | `resumeSession` 丢弃 runtime id、不 attach、不改 identity（**v1.2.0 漏项**） |
| C | `ChatPage.tsx:388-391` | `handleSend` 吞 4001 |
| D | `ChatPage.tsx:158` + `types.ts:132-135` | 事件过滤用 stored id 且 fail-open |
| E | `ws.ts:85-88` | 丢弃 `error.code` |
| F3 | `ChatPage.tsx:308` | `session.title` 用 stored id（实为 runtime RPC），且非活动行会被误改 |
| F4 | `ChatPage.tsx:515-517` | `workspace.move` 误用 `session_id`（应 `session_key`） |
| F5 | `SubagentsPanel.tsx:29`（`ChatPage` 传 `activeId`） | `subagent.list` 用 stored id |
| F6 | `ChatPage.tsx:269-279` | `?session=` 深链不 attach |
| F7 | `ChatPage.tsx:281-298` + `types.ts:114-120` | `session.create` 未区分 `session_id`/`stored_session_id` |
| F8 | `design` v1.2.0 | `normalizeResumedId` 的 `?? id` 回退可产生 `{S,S}` fail-open |

## 7. 修复 (Fix)
1. `types.ts`：`normalizeResumedId` 仅取 `session_id`（缺失→null）；新增 `normalizeCreatedIdentity` → `{storedId: stored_session_id, runtimeId: session_id}`（两者缺一→null）；新增严格 `matchesRuntime`。
2. `ws.ts`：rejection 附带 `code`；新增 `isSessionNotFound`。
3. `ChatPage.tsx`：`SessionIdentity` + `identityRef`/`activeIdRef` + in-flight 去重；`selectSession` 同步清空后 attach；`onResume` 改为等价点选；`createSession` 用双字段；`renameSession` 按目标行临时 resume；`deleteSession` 用 stored id；`handleSend` 按对发送 + 4001 有界重试；事件严格过滤；`events.since` 依赖 identity/activeId 且早退；`title`/`interrupt`/`file.attach`/`subagent.*` 用 runtime id；`workspace.move` 用 `session_key`；深链 attach。
4. BFF 无改动。

## 8. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | high | - | - | 用户点选或深链进入存储会话 S | chat page | 同步清空身份后以 stored id resume，仅在取得 runtime id 且 S 仍选中时提交身份对 | Given 列表含 S, When 点击 S, Then identity 先置 null；成功后为 `{storedId:S, runtimeId:R}`（R 非空且 R≠S）；归一化失败则 identity 为 null 并报错 |
| REQ-002 | high | - | 会话已 attach | 发起 session-scoped RPC 或收到会话事件 | chat page | 按 §2 矩阵使用正确身份键 | Given 身份对(S,R), When submit/interrupt/title/file.attach/subagent.list/events.since, Then `session_id`=R；`workspace.move` 用 `session_key:S`；`delete` 用 S |
| REQ-003 | high | - | 会话已 attach | 某 runtime-id RPC 返回 4001 | chat page | 以发送时 captured stored id 重新 resume 并重试恰好一次 | Given `prompt.submit` 首次 4001, When 重试, Then 用**发送时** S resume 后重发一次；仅重试失败才提示 |
| REQ-004 | medium | - | - | resume/RPC 失败 | chat page | 透传网关真实错误信息 | Given 失败消息 M, Then 显示 M |
| REQ-005 | high | - | 用户可在 resume 未返回时切换会话 | 迟到 resume 响应或跨会话读取 | chat page | 仅当 `identity.storedId === activeId` 时才提交/使用，否则丢弃 | Given 选中 A 未等响应即切 B, When A 响应到达, Then identity 仍属 B；不会向 A 的 runtime id 发任何 RPC |
| REQ-006 | high | - | - | 用户新建会话 | chat page | 以回包 `stored_session_id` 作 storedId、`session_id` 作 runtimeId，零 resume | Given create 返回 `{session_id:R, stored_session_id:S}`, Then identity=`{S,R}`、列表项 id=S，且 `session.resume` 调用为 0 |
| REQ-007 | high | - | - | 通过 `?session=` 深链进入 | chat page | 与点选一致地 attach | Given URL 含 `?session=S` 且列表含 S, Then 触发一次 `session.resume{session_id:S}` 并建立身份对 |
| REQ-008 | low | - | - | （可选 F2）展示往期消息 | chat page | 可渲染历史消息 | Given resume 回包含 messages, When 选中会话, Then 显示往期消息（Ask First） |
| REQ-009 | high | - | 存在活动会话 A | 用户对目标行 T 执行重命名/删除 | chat page | 重命名用 T 的 runtime id（必要时按 T 临时 resume），删除用 T 的 storedId；均不得改变活动身份 | Given 活动 A、目标 T≠A, When 重命名 T, Then `session.title{session_id: T 的 runtime}` 且 identity 仍为 A；When 删除 T, Then `session.delete{session_id:T}` |
| REQ-010 | high | - | - | 用户触发「恢复」菜单 | chat page | 走与点选相同的 attach 路径 | Given 对 T 触发恢复, Then 与 `selectSession(T)` 行为一致（同步清空 + resume + 守卫） |

## 9. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 点选即 resume | When 点击 S | 断言 resume 参数/次数 |
| 只接受 session_id | Given resume 返回 `{}` 或仅 stored id | 断言报错且 identity null |
| 矩阵身份 | When 各 RPC | 断言 `session_id`/`session_key` |
| 4001 有界恢复 | When 首次 4001 | 断言发送时 S resume + 一次重试 |
| 乱序守卫 | When A 迟到 | 断言 identity 不被覆盖 |
| create 双字段 | Given create 返回两字段 | 断言 identity 与列表项 id |
| 逐行操作隔离 | Given 活动 A、目标 T | 断言 T 的 runtime id 且 identity 仍为 A |
| 恢复菜单等价 | When 触发恢复 T | 断言与点选同序列 |

## 10. 非功能需求
- NFR-001: resume 不因渲染重复触发；同 id 并发 attach 去重。
- NFR-002: 4001 自动恢复最多一次；resume 自身 4001 不递归。
- NFR-003: TypeScript strict 无 `any` 泄漏；`npm run check` 全绿。

## 11. 属性测试 (Property-Based Tests)
1. **身份不变量（限 runtime-id RPC）**：对任意 runtime-id session-scoped RPC（submit/interrupt/title/file.attach/subagent.list/events.since），发出前必存在身份对 `{S,R}`，R 非空且来自 resume/create 回包；R 永不等于 S。（`delete`/`workspace.move` 用 stored id，不受此约束。）
2. **有界恢复**：仅首次 4001 时追加一次 resume + 一次重试；重试失败不再重试；resume 自身 4001 不递归。
3. **无回归（create）**：`session.create` 后首个 `prompt.submit` 用回包 `session_id`；`session.resume` 调用为 0；列表项 id == `stored_session_id`。
4. **乱序安全**：任意切换时序下，迟到响应不改变当前身份对。
5. **身份一致性**：所有会话事件 `session_id` 与事件回放所用 id 相同（runtime）；缺 `session_id` 事件不放行。
6. **会话隔离**：任意时刻发出的 runtime-id RPC，其 `session_id` 属于当前选中会话。
7. **create 双 id**：`normalizeCreatedIdentity` 对缺任一字段的回应返回 null（不得退化）。
8. **逐行操作隔离**：对非活动目标 T 的重命名/删除，不得改写当前 identity，也不得对活动会话发 RPC。

## 12. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 用身份对寻址；提交前同步清空；严格事件过滤；错误透传；并发 attach 去重 |
| ❓ Ask First | `session.resume` 的 lazy/defer_history/omit_messages；历史消息渲染；新增依赖 |
| 🚫 Never Do | 归一化失败回退 stored id；`normalizeResumedId` 接受 `id`；用 stored id 调 runtime-id RPC；向非当前会话的 runtime id 发 RPC；逐行操作改写当前 identity；无限重试；改 BFF 语义；猜测未验证 schema |
