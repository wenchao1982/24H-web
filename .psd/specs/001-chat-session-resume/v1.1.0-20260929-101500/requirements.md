# Bugfix Specification: 历史会话未 resume 导致 prompt.submit 被拒 (4001)
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix | Version: v1.1.0-20260929-101500 | Parent: v1.0.0
> 本版修订 v1.0.0 对抗性评审的 4 项问题。

## 1. 业务背景
真机测试 24H Web 对话功能时报错：
`tui_gateway.server: session-scoped RPC rejected: method=prompt.submit session_id='20260928_102322_7f04bb' not in memory (detached/reaped runtime; client should resume the stored session), rid=24`

用户点选历史会话后发送消息，网关拒绝该 turn，界面无任何助手输出。BFF 为透明管道，无责；缺陷在前端 `apps/web/src/chat`。

官方契约（Hermes 源码 `tui_gateway/`）：
- `contracts/sessions.py:174-191`：`session.resume` 入参 `session_id` 是**存储 id (stored id)**（或精确标题）；**返回的 `session_id` 是运行时 id (runtime id)**。
- `methods_session.py:118-124`：`session.list` 行的 `id` 是**存储 id**。
- `server.py:1167-1183` `_sess_nowait`：运行时 id 不在 `_sessions` → `_err(4001, "session not found")`。
- `server.py:848-850` `_err`：JSON-RPC error 结构为 `{code, message, data?}`。
- `methods_session.py:789-805` `_resume_response`：返回 `{ session_id: <runtime>, resumed: <stored>, session_key: <stored>, messages, info, ... }`。
- **事件身份证据**：`server.py:665-668` `_event_frame` 写入 `params.session_id = sid`；`event_replay.py:57` 以 `params["session_id"]` 作为回放 ring 键 → `session.events.since` 必须以**运行时 id** 寻址，否则取到空 ring。

## 2. 当前行为 (Current Behavior)
- When 用户点选 `session.list` 返回的历史会话（存储 id S），Then 前端仅 `setActiveId(S)` + 清空 transcript，**从不调用 `session.resume`**（`ChatPage.tsx:300-303`）。
- When 用户发送消息，Then 前端以存储 id S 调 `prompt.submit`（`ChatPage.tsx:371-394`）→ 网关 4001 + WARN。
- When 前端收到 4001，Then 仅显示通用「发送失败」并停止（`ChatPage.tsx:388-391`），无自动 resume、无重试。
- When 网关回 `message.delta`，Then 事件过滤 `isSameSession(payload, activeIdRef.current)` 用存储 id 比运行时 id → 增量被全部丢弃（`ChatPage.tsx:158`）。
- When 用户用「恢复」菜单，Then `resumeSession` 调了 resume 但**丢弃返回的运行时 id**，仍按存储 id 记录（`ChatPage.tsx:332-343`）。
- When 需要按错误码判定 4001，Then `GatewayClient.dispatch` 只保留 `message`、**丢弃 `code`**（`ws.ts:85-88`），故当前无法可靠识别 4001。

## 3. 期望行为 (Expected Behavior)
- When 点选历史会话，Then 以存储 id 调 `session.resume`，并**仅在归一化出运行时 id 后**记录活动会话；归一化失败必须报错，**不得回退为存储 id**。
- When 发起任何 session-scoped RPC（`prompt.submit` / `session.interrupt` / 附件 / `session.events.since`）或过滤会话事件，Then 一律使用运行时 id。
- When 某 session-scoped RPC 返回 4001，Then 以**发起该 RPC 时捕获的存储 id**重新 resume 并**重试恰好一次**；重试仍失败才提示。
- When resume 响应迟到（用户已切换会话），Then 不得覆盖当前会话的运行时 id。
- When 发生错误，Then 透传网关真实错误信息。

## 4. 不变行为 (Unchanged Behavior)
- `session.create` 路径不变：直接用返回 id（即运行时 id），不触发多余 resume。
- 非 session-scoped RPC（`session.list` / `session.title` / `session.delete` / `session.workspace.move`）行为不变。
- BFF `/api/hermes/ws` 代理保持透明（JSON-RPC error 原样回传）；BFF 无需改动。

## 5. 根因 (Root Cause)
| 编号 | 位置 | 描述 |
| --- | --- | --- |
| A | `ChatPage.tsx:300-303` | `selectSession` 从不调用 `session.resume` |
| B | `ChatPage.tsx:332-343` | `resumeSession` 丢弃返回的运行时 id |
| C | `ChatPage.tsx:388-391` | `handleSend` 吞 4001，无自动恢复与重试 |
| D | `ChatPage.tsx:158` 等 | 事件过滤 / session-scoped RPC 使用存储 id |
| E | `ws.ts:85-88` | 丢弃 JSON-RPC `error.code`，无法可靠识别 4001 |

## 6. 修复 (Fix)
会话「双身份」模型：`storedId`（列表/高亮/resume 入参）与 `runtimeId`（所有 session-scoped RPC + 事件过滤）。
1. `types.ts` 新增 `normalizeResumedId(result): string | null` → `session_id ?? id`。
2. `ChatPage` 新增 `runtimeId` 与 `attachSession(storedId)`：resume 后**必须**取得运行时 id，否则抛出（禁止 `?? storedId` fail-open）。
3. `selectSession` 先高亮再 attach；**乱序守卫**：仅当返回时该 storedId 仍为当前选中会话才写入 runtimeId。
4. `handleSend` 捕获发送时的 `storedId`；4001 时以该 storedId 重试一次（不使用可能已切换的当前 activeId）。
5. 事件过滤、`session.interrupt`、`session.events.since`、附件统一使用运行时 id（events.since 已由源码证据确认）。
6. `ws.ts` 在 rejection 上附带 `code`；`isSessionNotFound` 优先判 `code === 4001`，回退文案匹配 `/session not found/i`。

## 7. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | high | - | - | 用户点选 session.list 返回的存储会话 S | chat page | 以存储 id 调 session.resume 并仅在取得运行时 id 后记录活动会话；归一化失败则报错 | Given 列表含 S, When 点击 S, Then 恰好一次 `session.resume{session_id:S}`；若响应无运行时 id 则显示错误且 runtimeId 保持为空（不得等于 S） |
| REQ-002 | high | - | 会话已 attach(有运行时 id) | 用户发送消息或网关推送事件 | chat page | 以运行时 id 寻址 session-scoped RPC 并据此过滤事件 | Given resume 返回运行时 id R(存储 S), When 发送消息, Then `prompt.submit{session_id:R}` 且 `message.delta{session_id:R}` 渲染；`session.events.since` 亦用 R（证据 event_replay.py:57） |
| REQ-003 | high | - | 会话已 attach | 某 session-scoped RPC 返回 4001 | chat page | 以发送时捕获的存储 id 重新 resume 并重试该 RPC 恰好一次 | Given `prompt.submit` 首次 4001, When 重试路径执行, Then 用**发送时**的存储 S 调 `session.resume`，再以新运行时 id 重发一次；仅重试仍失败才提示 |
| REQ-004 | medium | - | - | resume 或 RPC 失败 | chat page | 透传网关真实错误信息 | Given 失败消息 M, Then 显示 M 而非「发送失败」 |
| REQ-005 | high | - | 用户可在 resume 未返回时切换会话 | 迟到的 resume 响应到达 | chat page | 仅当对应 storedId 仍为当前选中会话时才写入运行时 id | Given 选中 A 后未等响应即切到 B, When A 的 resume 响应到达, Then 当前运行时 id 仍属 B，A 的响应被丢弃 |

## 8. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 点选存储会话 S | When 点击 S | fake gateway 断言 resume 参数与调用次数 |
| 归一化失败不得回退 | Given resume 返回 `{}` | 断言 runtimeId 仍为 null 且显示错误 |
| 4001 自动恢复 | When 首次 reject(4001) | 断言以发送时 storedId resume + 重试一次 |
| 乱序不覆盖 | When A 响应迟到 | 断言 A 的 runtimeId 未被写入 |
| events.since 用 runtime | Given resume 返回 R | 断言 `session.events.since{session_id:R}` |

## 9. 非功能需求
- NFR-001: resume 不得因渲染重复触发（stable callback + ref）。
- NFR-002: 4001 自动恢复最多一次，重试失败后不再重试（有界，无循环）。
- NFR-003: TypeScript strict 无 `any` 泄漏；`npm run check` 全绿。

## 10. 属性测试 (Property-Based Tests)
1. **身份不变量**：对任意存储 id S 与任意 session-scoped RPC，发出前必存在一次成功 resume 且取得的运行时 id 非空；该 RPC 的 `session_id` == 最近一次成功 resume 的运行时 id；**运行时 id 永不等于列表存储 id**（不得 fail-open）。
2. **恢复有界性**：仅当首次 4001 时恰好追加一次 resume + 一次重试；重试失败不再重试；resume 自身 4001 亦不得递归。
3. **无回归**：`session.create` 后首个 `prompt.submit` 直接用 create 返回 id，不触发多余 resume。
4. **乱序安全**：任意会话切换时序下，迟到的 resume 响应不得改变当前活动会话的运行时 id。
5. **身份一致性**：所有会话事件（`message.delta`/`complete`/`tool.*`/`thinking`/`done`/`error`）的 `session_id` 与事件回放所用 id 相同（运行时 id）。

## 11. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | session-scoped RPC 前确保 runtimeId 来自 resume/create 回包；事件与回放用运行时 id；错误信息透传；迟到响应丢弃 |
| ❓ Ask First | `session.resume` 的 `lazy`/`defer_history`/`omit_messages` 选项；历史消息渲染 (F2)；是否新增依赖 |
| 🚫 Never Do | 用存储 id 调 `prompt.submit`；归一化失败回退为存储 id（fail-open）；无限重试；改动 BFF 代理语义；猜测未验证的 schema |
