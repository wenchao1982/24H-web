# Tasks: Bugfix 001-chat-session-resume
> Spec ID: 001-chat-session-resume | Phase: tasks | Version: v1.2.0-20260929-103000 | Parent: v1.1.0

## 实施任务（Wave-based）

### Wave 0 — 基线文档（红线 §11：先文档后代码）
| ID | Description | REQ Link | Priority | Verification |
| --- | --- | --- | --- | --- |
| TASK-000 | `architecture.md`：会话身份对模型 + §2 契约矩阵（附源码行号） | REQ-001,REQ-002 | high | 文档评审 |
| TASK-001 | `requirement.md`/`ui-spec.md`：点选即 attach、4001 有界恢复、身份矩阵、`workspace.move` 用 `session_key` | REQ-001,REQ-002,REQ-003,REQ-004 | high | 文档评审 |
| TASK-002 | `task-list.md`：登记本修复（建议 N15） | REQ-001,REQ-002,REQ-003,REQ-004,REQ-005,REQ-006,REQ-007 | medium | 看板可见 |

### Wave 1 — 代码（依赖 Wave 0）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-003 | `types.ts`：`normalizeResumedId` + `matchesRuntime` + 单测 | REQ-001,REQ-002 | high | TASK-002 | 单测通过 |
| TASK-004 | `ws.ts`：rejection 带 `code` + `isSessionNotFound` + 单测 | REQ-003 | high | TASK-002 | 单测通过 |
| TASK-005 | `ChatPage`：`SessionIdentity` + `identityRef`/`activeIdRef`/`attachInFlightRef` + `attachSession`（去重/抛错/乱序守卫） | REQ-001,REQ-005 | high | TASK-003,TASK-004 | 单测通过 |
| TASK-006 | `selectSession` 同步清空 + attach；`?session=` 深链同路径 | REQ-001,REQ-007 | high | TASK-005 | 单测通过 |
| TASK-007 | `createSession` 写入身份对（零 resume） | REQ-006 | high | TASK-005 | 单测通过 |
| TASK-008 | `handleSend`：按身份对发送 + 4001 以发送时 storedId 有界重试 + 切换丢弃 | REQ-002,REQ-003 | high | TASK-005 | 单测通过 |
| TASK-009 | 事件过滤改严格 `matchesRuntime` + `session.events.since` effect 依赖改 identity/activeId | REQ-002,REQ-005 | high | TASK-005 | 单测通过 |
| TASK-010 | 身份矩阵落地：`session.title`/`interrupt`/`file.attach`/`subagent.list` 用 runtime id；`workspace.move` 用 `session_key`；`delete` 用 stored id | REQ-002 | high | TASK-005 | 单测通过 |
| TASK-011 | 错误文案透传（含归一化失败、重试失败） | REQ-004 | medium | TASK-008 | 单测通过 |
| TASK-012 | 测试辅助 `fakeGateway` 增加 `session.resume` 默认应答 | REQ-001,REQ-006 | high | TASK-005 | 既有用例不因归一化失败而红 |

### Wave 2 — 验证（依赖 Wave 1）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-013 | `ChatPage.test.tsx` 新用例：身份对/矩阵/4001/归一化失败/乱序/create 零 resume/深链/缺 session_id 事件不放行 | REQ-001,REQ-002,REQ-003,REQ-005,REQ-006,REQ-007 | high | TASK-006,TASK-008,TASK-009,TASK-010,TASK-012 | 新用例通过 |
| TASK-014 | `npm run check` 全绿 | REQ-001..REQ-007 | high | TASK-013 | 退出码 0 |
| TASK-015 | 真机：历史会话点选→发送→回复；重命名/移动工作区通过；网关无 4001 WARN | REQ-002,REQ-003 | high | TASK-014 | 观察到回复 |
| TASK-016 | （可选 F2）历史消息渲染 | REQ-008 | low | TASK-015 | 可见往期消息 |

## Traceability Matrix
| Requirement | Tasks | Coverage |
| --- | --- | --- |
| REQ-001 | TASK-000, TASK-001, TASK-002, TASK-003, TASK-005, TASK-006, TASK-012, TASK-013 | full |
| REQ-002 | TASK-000, TASK-001, TASK-003, TASK-008, TASK-009, TASK-010, TASK-013, TASK-014, TASK-015 | full |
| REQ-003 | TASK-001, TASK-004, TASK-008, TASK-011, TASK-013, TASK-014, TASK-015 | full |
| REQ-004 | TASK-001, TASK-011 | full |
| REQ-005 | TASK-002, TASK-005, TASK-009, TASK-013, TASK-014 | full |
| REQ-006 | TASK-002, TASK-007, TASK-012, TASK-013, TASK-014 | full |
| REQ-007 | TASK-002, TASK-006, TASK-013, TASK-014 | full |
| REQ-008 | TASK-016 | optional |

## Dependency Graph
```
TASK-000 ─┐
TASK-001 ─┼─> TASK-002 ─┬─> TASK-003 ─┐
          │             └─> TASK-004 ─┴─> TASK-005 ─┬─> TASK-006 ─┐
          │                                        ├─> TASK-007 ─┤
          │                                        ├─> TASK-008 ─┼─> TASK-013 ─> TASK-014 ─> TASK-015 ─> TASK-016
          │                                        ├─> TASK-009 ─┤
          │                                        ├─> TASK-010 ─┤
          │                                        └─> TASK-012 ─┘
TASK-011 依赖 TASK-008
```

## Conformance Checklist
- [ ] 每个 GEARS 需求映射到测试与任务
- [ ] DAG 无环
- [ ] 身份对不变式 ID-1..ID-4 均有守卫
- [ ] 归一化失败不得回退为 stored id
- [ ] 无跨会话 RPC（`identity.storedId === activeId` 前置）
- [ ] 身份矩阵每条均有源码证据
- [ ] BFF 未改动
