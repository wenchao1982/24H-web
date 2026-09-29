# Tasks: Bugfix 001-chat-session-resume
> Spec ID: 001-chat-session-resume | Phase: tasks | Version: v1.1.0-20260929-101500 | Parent: v1.0.0

## 实施任务（Wave-based）

### Wave 0 — 基线文档（红线 §11：先文档后代码）
| ID | Description | REQ Link | Priority | Verification |
| --- | --- | --- | --- | --- |
| TASK-000 | 更新 `architecture.md`：会话身份 (stored id vs runtime id)、resume 语义、events.since 以运行时 id 寻址（附源码行号证据） | REQ-001,REQ-002 | high | 文档评审通过 |
| TASK-001 | 更新 `requirement.md` / `ui-spec.md`：点选即 attach、4001 有界自动恢复、错误透传 | REQ-001,REQ-003,REQ-004 | high | 文档评审通过 |
| TASK-002 | 更新 `task-list.md`：登记本修复项（建议 N15） | REQ-001,REQ-002,REQ-003,REQ-004,REQ-005 | medium | 看板可见 |

### Wave 1 — 代码（依赖 Wave 0）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-003 | `types.ts` 新增 `normalizeResumedId`（缺失返回 null）+ 单测 | REQ-001 | high | TASK-002 | 单测通过 |
| TASK-004 | `ws.ts` rejection 附带 `code`；新增 `isSessionNotFound` + 单测 | REQ-003 | high | TASK-002 | 单测通过 |
| TASK-005 | `ChatPage` 新增 `runtimeId`/`attachSession`（禁止 fail-open；含乱序守卫） | REQ-001,REQ-005 | high | TASK-003,TASK-004 | 单测通过 |
| TASK-006 | `selectSession` / `resumeSession` 接入 `attachSession` | REQ-001 | high | TASK-005 | 单测通过 |
| TASK-007 | `handleSend` 用 runtime id + 4001 以**发送时 storedId** 有界重试 | REQ-003 | high | TASK-005 | 单测通过 |
| TASK-008 | 事件过滤 / `session.interrupt` / `session.events.since` / 附件改用 runtime id | REQ-002 | high | TASK-005 | 单测通过 |
| TASK-009 | 错误文案透传（含归一化失败路径） | REQ-004 | medium | TASK-007 | 单测通过 |

### Wave 2 — 验证（依赖 Wave 1）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-010 | `ChatPage.test.tsx` 新增：选中→resume→runtime 提交；事件按 runtime；4001 以发送时 storedId 恢复；归一化失败报错；乱序不覆盖 | REQ-001,REQ-002,REQ-003,REQ-005 | high | TASK-006,TASK-007,TASK-008 | 新用例通过 |
| TASK-011 | `npm run check` 全绿 | REQ-001,REQ-002,REQ-003,REQ-004,REQ-005 | high | TASK-010 | 命令退出码 0 |
| TASK-012 | 真机验证：历史会话点选→发送→可见回复；网关无 4001 WARN | REQ-002,REQ-003 | high | TASK-011 | 观察到回复 |
| TASK-013 | （可选, F2）历史消息渲染（resume.messages 或 L2 messages） | — (Ask First) | low | TASK-012 | 可见往期消息 |

## Traceability Matrix
| Requirement | Tasks | Coverage |
| --- | --- | --- |
| REQ-001 | TASK-000, TASK-001, TASK-002, TASK-003, TASK-005, TASK-006, TASK-010 | full |
| REQ-002 | TASK-000, TASK-002, TASK-008, TASK-010, TASK-011, TASK-012 | full |
| REQ-003 | TASK-001, TASK-004, TASK-007, TASK-010, TASK-011, TASK-012 | full |
| REQ-004 | TASK-001, TASK-009 | full |
| REQ-005 | TASK-002, TASK-005, TASK-010, TASK-011 | full |

## Dependency Graph
```
TASK-000 ─┐
TASK-001 ─┼─> TASK-002 ─┬─> TASK-003 ─┐
          │             └─> TASK-004 ─┴─> TASK-005 ─┬─> TASK-006 ─┐
          │                                        ├─> TASK-007 ─┼─> TASK-010 ─> TASK-011 ─> TASK-012 ─> TASK-013
          │                                        └─> TASK-008 ─┘
```
（TASK-009 依赖 TASK-007。）

## Conformance Checklist
- [ ] 每个 GEARS 需求映射到测试用例
- [ ] 无循环依赖
- [ ] 4001 恢复有界（最多一次）
- [ ] 归一化失败不得回退为存储 id（Never 边界有运行时守卫）
- [ ] events.since 身份有源码证据（event_replay.py:57 / server.py:665-668）
- [ ] BFF 未改动
