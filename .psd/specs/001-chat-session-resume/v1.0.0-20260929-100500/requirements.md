# Bugfix Specification: 历史会话未 resume 导致 prompt.submit 被拒 (4001)
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix | Version: v1.0.0-20260929-100500

## 1. 业务背景
真机测试 24H Web 对话功能时报错：
`tui_gateway.server: session-scoped RPC rejected: method=prompt.submit session_id='20260928_102322_7f04bb' not in memory (detached/reaped runtime; client should resume the stored session), rid=24`

用户点选历史会话后发送消息，网关拒绝该 turn，界面无任何助手输出。BFF 为透明管道，无责；缺陷在前端 `apps/web/src/chat`。

官方契约（Hermes 源码 `tui_gateway/contracts/sessions.py:174-191`）：
- `session.resume` 的入参 `session_id` 是 **存储 id (stored id)**（或精确标题）；
- **返回的 `session_id` 是运行时 id (runtime id)**；
- `session.list` 返回的 `id` 是 **存储 id**；
- 所有 session-scoped RPC（`prompt.submit` / `session.interrupt` / 附件 / `session.events.since`）必须使用 **运行时 id**；否则 `_sess_nowait` 返回 `_err(4001, "session not found")`（`tui_gateway/server.py:1167-1183`）。

## 2. 当前行为 (Current Behavior)
- When 用户在会话列表点选一个由 `session.list` 返回的历史会话（存储 id S），Then 前端仅 `setActiveId(S)` 并清空 transcript，**从不调用 `session.resume`**（`ChatPage.tsx:300-303`）。
- When 用户随后发送消息，Then 前端以存储 id S 调用 `prompt.submit`（`ChatPage.tsx:371-394`），网关返回 4001 并记录 WARN 日志。
- When 前端收到 4001，Then `handleSend` 的 `.catch` 仅显示通用文案「发送失败」并停止（`ChatPage.tsx:388-391`），**无自动 resume、无重试**，消息静默丢失。
- When 网关实际返回了 `message.delta`/`message.complete`，Then 因事件过滤 `isSameSession(payload, activeIdRef.current)` 用存储 id 比对运行时 id，增量被全部过滤，界面永远看不到流式输出（`ChatPage.tsx:158`）。
- When 用户改用「恢复」菜单项，Then `resumeSession` 虽调用 `session.resume`，但**丢弃返回的运行时 id**，仍 `setActiveId(存储 id)`（`ChatPage.tsx:332-343`），问题依旧。

## 3. 期望行为 (Expected Behavior)
- When 用户点选历史会话，Then 前端以存储 id 调用 `session.resume`，并将返回的**运行时 id**记录为当前会话的活动 id。
- When 前端发起任何 session-scoped RPC 或过滤会话事件，Then 一律使用当前**运行时 id**。
- When 某 session-scoped RPC 返回 4001，Then 前端自动以存储 id 重新 `session.resume` 并**重试一次**；仅当重试仍失败才提示错误。
- When 发生错误，Then 提示应透传网关真实错误信息，而非通用文案。

## 4. 不变行为 (Unchanged Behavior)
- When 用户「新建会话」，Then 仍直接使用 `session.create` 返回的 id 作为活动 id（该 id 即运行时 id），不触发多余 resume。
- When 调用非 session-scoped RPC（`session.list` / `session.title` / `session.delete` / `session.workspace.move`），Then 行为与本修复前一致。
- When 请求经 BFF `/api/hermes/ws`，Then 代理保持透明（JSON-RPC error 原样回传），BFF 无需改动。

## 5. 根因 (Root Cause)
| 编号 | 位置 | 描述 |
| --- | --- | --- |
| A | `apps/web/src/chat/ChatPage.tsx:300-303` | `selectSession` 从不调用 `session.resume`，历史会话从未 attach 进网关内存 |
| B | `apps/web/src/chat/ChatPage.tsx:332-343` | `resumeSession` 丢弃 `session.resume` 返回的运行时 id，仍按存储 id 记录活动会话 |
| C | `apps/web/src/chat/ChatPage.tsx:388-391` | `handleSend` 将 4001 吞为通用文案，无自动恢复与重试 |
| D | `apps/web/src/chat/ChatPage.tsx:158`（及 interrupt / events.since / 附件） | 事件过滤与 session-scoped RPC 使用存储 id 而非运行时 id |

## 6. 修复 (Fix)
引入会话「双身份」模型：`storedId`（列表项/高亮）与 `runtimeId`（所有 session-scoped RPC 与事件过滤）。
1. `types.ts` 新增 `normalizeResumedId(result): string | null` → `session_id ?? id`。
2. `ChatPage` 新增 `runtimeId` 状态与 `attachSession(storedId)`：调用 `session.resume { session_id: storedId }` 并捕获运行时 id。
3. `selectSession` 改为 async：先高亮存储 id，再 `attachSession`。
4. `handleSend` 使用 `runtimeIdRef.current`；捕获到 4001 时自动 `attachSession` 后重试一次。
5. `resumeSession` 复用 `attachSession`（修复 B）。
6. 事件过滤、`session.interrupt`、`session.events.since`、附件统一改用 `runtimeId`。
7. 错误文案透传网关 message。

## 7. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | high | - | - | 用户点选一个由 session.list 返回的存储会话 S | chat page | 以存储 id 调用 session.resume 并记录返回的运行时 id | Given 列表含存储会话 S, When 用户点击 S, Then 恰好发出一次 `session.resume {session_id:S}` 且活动 id 变为其返回的运行时 id |
| REQ-002 | high | - | 会话已 attach | 用户发送消息或网关推送会话事件 | chat page | 以运行时 id 寻址所有 session-scoped RPC 并据此过滤事件 | Given resume 返回运行时 id R（存储 id S）, When 发送消息, Then `prompt.submit` 携带 `session_id:R` 且 `message.delta{session_id:R}` 渲染进 transcript |
| REQ-003 | high | - | 会话已 attach | 某 session-scoped RPC 返回 4001 | chat page | 以存储 id 重新 resume 并重试该 RPC 恰好一次 | Given `prompt.submit` 首次返回 4001, When 重试路径执行, Then 先 `session.resume{stored}`, 再以新运行时 id 重发 `prompt.submit`，仅当重试仍失败才提示错误 |
| REQ-004 | medium | - | - | resume 或 RPC 失败 | chat page | 透传网关真实错误信息 | Given 失败消息为 M, Then 通知/transcript 显示 M 而非「发送失败」 |

## 8. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| When 点选存储会话 S | When 用户点击 S | mock gateway 断言 `session.resume` 参数 |
| 返回的运行时 id R | Given resume 返回 R | fake gateway 返回 `{session_id:R, resumed:S}` |
| 4001 自动恢复 | When 首次 4001 | fake gateway 首次 reject(4001)，断言第二次 resume+submit |
| 透传错误信息 | Then 显示 M | 断言 notice 文本含 M |

## 9. 非功能需求
- NFR-001: resume 不得在每次渲染重复触发（依赖 stable callback / ref，避免 effect 抖动）。
- NFR-002: 4001 自动恢复最多一次，杜绝无限重试循环。
- NFR-003: TypeScript strict 下无 `any` 泄漏；`npm run check` 全绿。

## 10. 属性测试 (Property-Based Tests)
1. **身份不变量**：对任意存储 id S 与任意 session-scoped RPC，在发出该 RPC 之前必存在一次成功的 `session.resume{session_id:S}`；且该 RPC 携带的 `session_id` 必等于最近一次 resume 返回的运行时 id。
2. **恢复有界性**：对任意 session-scoped RPC，当且仅当首次返回 4001 时，恰好追加一次 resume 与一次重试；重试失败后不再重试。
3. **无回归**：`session.create` 之后的首个 `prompt.submit` 直接使用 create 返回的 id，且不触发额外的 `session.resume`。

## 11. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 任何 session-scoped RPC 前确保已 attach（有运行时 id）；事件过滤用运行时 id；错误信息透传 |
| ❓ Ask First | 是否引入 `session.resume` 的 `lazy` / `defer_history` / `omit_messages` 选项；是否顺带实现历史消息渲染 (F2) |
| 🚫 Never Do | 不得用存储 id 调 `prompt.submit`；不得无限重试；不得改动 BFF 透明代理语义；不得猜测 Hermes 内部 schema |
