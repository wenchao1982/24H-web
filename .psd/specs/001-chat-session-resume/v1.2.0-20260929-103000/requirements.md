# Bugfix Specification: 会话身份（stored id / runtime id）与历史会话 resume
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix | Version: v1.2.0-20260929-103000 | Parent: v1.1.0
> 本版修正 v1.1.0 对抗性评审的 2 项 CRITICAL + 1 项 HIGH + 1 项 MEDIUM（用户授权第 3 轮回环）。

## 1. 业务背景
真机测试 24H Web 对话报错：
`tui_gateway.server: session-scoped RPC rejected: method=prompt.submit session_id='20260928_102322_7f04bb' not in memory (detached/reaped runtime; client should resume the stored session), rid=24`

用户点选历史会话后发送消息被网关拒绝，界面无助手输出。BFF 为透明管道，无责；缺陷在前端 `apps/web`。

## 2. 契约事实（官方源码，均为证据）
| RPC | 身份键 | 证据 |
| --- | --- | --- |
| `session.resume` | 入参 = **stored id**；回包 `session_id` = **runtime id** | `tui_gateway/contracts/sessions.py:174-191` |
| `session.list` | 行 `id` = **stored id** | `methods_session.py:118-124` |
| `prompt.submit` | **runtime id** | `methods_prompt.py:585` → `server.py:1167-1183 _sess_nowait` |
| `session.interrupt` | **runtime id** | `methods_session.py:2146-2149` |
| `file.attach` | **runtime id** | `methods_prompt.py:845-849` (`_sess_building`→`_sess_nowait`) |
| `session.title`（含重命名） | **runtime id** | `methods_session.py:1096-1097`（`_with_db(..., session_scoped=True)` → `_with_session` → `_sess_nowait`） |
| `subagent.list` | **runtime id** | `methods_subagents.py:53-58` |
| `session.events.since` | **runtime id**（回放 ring 键） | `server.py:665-668` 写 `params.session_id = sid`；`event_replay.py:57` 按该键分桶 |
| `session.delete` | **stored id**（DB 键；按 `session_key` 判定"活动"） | `methods_session.py:1055-1064` |
| `session.workspace.move` | **stored id，但字段名是 `session_key`（不是 `session_id`）** | `methods_session.py:987-992` |
| 错误结构 | `{code, message, data?}` | `server.py:848-850 _err` |
| 4001 判定 | 未知 runtime id | `server.py:1167-1183` |

## 3. 当前行为 (Current Behavior)
- When 点选历史会话 S，Then 前端仅 `setActiveId(S)` + 清空 transcript，**从不 resume**（`ChatPage.tsx:300-303`）。
- When 发送消息，Then 以 S 调 `prompt.submit`（`ChatPage.tsx:371-394`）→ 4001 WARN。
- When 收到 4001，Then 仅通用「发送失败」，无恢复无重试（`ChatPage.tsx:388-391`）。
- When 网关回 `message.delta`，Then 事件过滤用 S 比 runtime id → 全被丢弃（`ChatPage.tsx:158`、`types.ts:132-135` 且缺失 `session_id` 时 fail-open 返回 true）。
- When 用「恢复」菜单，Then `resumeSession` 丢弃返回的 runtime id（`ChatPage.tsx:332-343`）。
- When 重命名 `session.title`，Then 以 S 调（`ChatPage.tsx:308`）→ 实为 runtime id RPC → 对历史会话 4001（**潜伏缺陷 F3**）。
- When 移动工作区，Then 发送 `{session_id, workspace}`（`ChatPage.tsx:515-517`）→ 官方要求 `session_key` → 真机 4007（**潜伏缺陷 F4**）。
- When `subagent.list`，Then 以 `activeId`(=S) 调（`ChatPage.tsx:546,710`）→ 需 runtime id（**潜伏缺陷 F5**）。
- When 通过 `?session=` 深链进入，Then `setActiveId` 但**不 attach**（`ChatPage.tsx:269-279`）。
- When 判 4001，Then `ws.ts:85-88` 丢弃 `error.code`。

## 4. 期望行为 (Expected Behavior)
- 身份建模为**成对结构** `SessionIdentity = { storedId, runtimeId }`；仅在 `identity.storedId === 当前选中 storedId` 时可用于 session-scoped RPC。
- 点选历史会话：**同步**清空 identity，再 resume；归一化失败报错，**不得**回退 stored id。
- 所有 session-scoped RPC（按 §2 矩阵）使用 runtime id；`session.workspace.move` 使用 `session_key`；`session.delete` 保持 stored id。
- 事件过滤严格匹配 runtime id（缺失 `session_id` 的事件不得放行）。
- 4001 → 以**发送时**捕获的 storedId 有界重试一次。
- 迟到 resume 响应不得覆盖当前身份（乱序守卫）。
- `session.create` 回包 id 直接作为 runtime id，**零 resume**。
- 错误透传网关 message。

## 5. 不变行为 (Unchanged Behavior) — 均附证据
- `session.list`（stored id 列表）、`session.delete`（stored id）行为不变（§2 证据）。
- BFF `/api/hermes/ws` 代理保持透明；BFF 无需改动。
- 非会话域 RPC（`commands.catalog` / `complete.slash` / `profiles.*` 等）不受影响。

## 6. 根因 (Root Cause)
| 编号 | 位置 | 描述 |
| --- | --- | --- |
| A | `ChatPage.tsx:300-303` | `selectSession` 不 resume |
| B | `ChatPage.tsx:332-343` | `resumeSession` 丢弃 runtime id |
| C | `ChatPage.tsx:388-391` | `handleSend` 吞 4001 |
| D | `ChatPage.tsx:158` + `types.ts:132-135` | 事件过滤用 stored id 且缺失 id 时 fail-open |
| E | `ws.ts:85-88` | 丢弃 `error.code` |
| F3 | `ChatPage.tsx:308` | `session.title` 用 stored id（实为 runtime id RPC） |
| F4 | `ChatPage.tsx:515-517` | `session.workspace.move` 误用 `session_id`（应为 `session_key`） |
| F5 | `ChatPage.tsx:546,710` | `subagent.list` 用 stored id |
| F6 | `ChatPage.tsx:269-279` | `?session=` 深链不 attach |

## 7. 修复 (Fix)
1. `types.ts`：新增 `normalizeResumedId`（缺失返回 null）与严格匹配 `matchesRuntime(payload, runtimeId)`。
2. `ws.ts`：rejection 附带 `code`；新增 `isSessionNotFound`（`code===4001` 或 `/session not found/i`）。
3. `ChatPage.tsx`：引入 `SessionIdentity` 对 + `identityRef` + `activeIdRef`；`attachSession(storedId)`（in-flight 去重、归一化失败抛错、乱序守卫）；`selectSession` 同步清空身份后 attach；`createSession` 直接写入对；`handleSend` 按对发送 + 4001 有界重试；事件过滤严格按对；`session.title`/`interrupt`/`subagent.list`/附件 用 runtime id；`workspace.move` 用 `session_key`；深链也 attach。
4. BFF 无改动。

## 8. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | high | - | - | 用户点选 session.list 返回的存储会话 S | chat page | 同步清空身份后以 stored id resume，仅在取得 runtime id 且 S 仍选中时提交身份对 | Given 列表含 S, When 点击 S, Then identity 先置 null；resume 成功后为 `{storedId:S, runtimeId:R}`（R 非空）；归一化失败则 identity 仍为 null 并报错 |
| REQ-002 | high | - | 会话已 attach | 发起 session-scoped RPC 或网关推送事件 | chat page | 按 §2 矩阵使用正确身份键 | Given 身份对(S,R), When 发送消息/中断/重命名/附件/子代理/events.since, Then `session_id` 均为 R；`workspace.move` 用 `session_key:S`；`delete` 用 S |
| REQ-003 | high | - | 会话已 attach | 某 session-scoped RPC 返回 4001 | chat page | 以发送时捕获的 stored id 重新 resume 并重试恰好一次 | Given `prompt.submit` 首次 4001, When 重试, Then 用**发送时**的 S resume 后重发一次；仅重试失败才提示 |
| REQ-004 | medium | - | - | resume/RPC 失败 | chat page | 透传网关真实错误信息 | Given 失败消息 M, Then 显示 M |
| REQ-005 | high | - | 用户可在 resume 未返回时切换会话 | 迟到 resume 响应或跨会话读取到达 | chat page | 仅当 `identity.storedId === activeId` 时才提交/使用；否则丢弃 | Given 选中 A 未等响应即切 B, When A 响应到达, Then identity 仍属 B；且不会向 A 的 runtime id 发送任何 RPC |
| REQ-006 | high | - | - | 用户新建会话 | chat page | 以 create 回包的 id 直接构成身份对，零 resume | Given `session.create` 返回 C, When 之后首次发送, Then `prompt.submit{session_id:C}` 且 `session.resume` 调用次数为 0 |
| REQ-007 | high | - | - | 通过 `?session=` 深链进入 | chat page | 与点选一致地 attach | Given URL 含 `?session=S` 且列表含 S, Then 触发一次 `session.resume{session_id:S}` 并建立身份对 |
| REQ-008 | low | - | - | （可选 F2）展示往期消息 | chat page | 可渲染历史消息 | Given resume 回包含 messages, When 选中会话, Then transcript 显示往期消息（可选，Ask First） |

## 9. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 点选即 resume | When 点击 S | 断言 resume 参数/次数 |
| 归一化失败不回退 | Given resume 返回 `{}` | 断言 identity null + 错误 |
| 矩阵身份 | When 各 RPC | 断言各自 `session_id` / `session_key` |
| 4001 有界恢复 | When 首次 4001 | 断言发送时 S resume + 一次重试 |
| 乱序守卫 | When A 迟到 | 断言 identity 不被覆盖 |
| create 零 resume | Given create 返回 C | 断言 runtimeId=C 且 resume 0 次 |
| 深链 attach | Given `?session=S` | 断言 resume 触发 |

## 10. 非功能需求
- NFR-001: resume 不因渲染重复触发；同 id 并发 attach 必须去重（in-flight）。
- NFR-002: 4001 自动恢复最多一次；resume 自身 4001 不递归。
- NFR-003: TypeScript strict 无 `any` 泄漏；`npm run check` 全绿。

## 11. 属性测试 (Property-Based Tests)
1. **身份不变量**：任意 session-scoped RPC 发出前，必存在身份对 `{storedId:S, runtimeId:R}`，R 非空且来自 resume/create 回包；R 永不等于列表存储 id（不得 fail-open）。
2. **有界恢复**：仅首次 4001 时追加一次 resume + 一次重试；重试失败不再重试；resume 自身 4001 不递归。
3. **无回归（create）**：`session.create` 后首个 `prompt.submit` 用 create 回包 id，`session.resume` 调用为 0。
4. **乱序安全**：任意切换时序下，迟到响应不改变当前身份对。
5. **身份一致性**：所有会话事件的 `session_id` 与事件回放所用 id 相同（runtime id）；缺 `session_id` 的事件不放行。
6. **会话隔离**：任意时刻发出的 session-scoped RPC，其 `session_id` 必属于当前选中会话（`identity.storedId === activeId`）。

## 12. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 用身份对寻址；提交前同步清空；严格事件过滤；错误透传；并发 attach 去重 |
| ❓ Ask First | `session.resume` 的 lazy/defer_history/omit_messages；历史消息渲染 (F2)；新增依赖 |
| 🚫 Never Do | 归一化失败回退为 stored id；用存储 id 调 `prompt.submit`/`session.title`/`subagent.list`；向非当前会话的 runtime id 发送 RPC；无限重试；改 BFF 语义；猜测未验证 schema |
