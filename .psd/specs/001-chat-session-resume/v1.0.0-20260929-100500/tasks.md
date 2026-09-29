# Tasks: Bugfix 001-chat-session-resume
> Spec ID: 001-chat-session-resume | Phase: tasks | Version: v1.0.0-20260929-100500

## 实施任务（Wave-based）

### Wave 0 — 基线文档（红线 §11：先文档后代码）
| ID | Description | REQ Link | Priority | Verification |
| --- | --- | --- | --- | --- |
| TASK-000 | 更新 `architecture.md`：新增「会话身份：stored id vs runtime id + session.resume 语义」 | REQ-001,REQ-002 | high | 文档评审通过 |
| TASK-001 | 更新 `requirement.md` / `ui-spec.md`：对话恢复行为（点选即 attach、4001 自动恢复） | REQ-001,REQ-003 | high | 文档评审通过 |
| TASK-002 | 更新 `task-list.md`：登记本修复项（建议 N15） | REQ-001..004 | medium | 看板可见 |

### Wave 1 — 代码（依赖 Wave 0）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-003 | `types.ts` 新增 `normalizeResumedId` + 单测 | REQ-002 | high | TASK-002 | 单测通过 |
| TASK-004 | `ChatPage` 新增 `runtimeId` 状态/ref 与 `attachSession` | REQ-001,REQ-002 | high | TASK-003 | 单测通过 |
| TASK-005 | `selectSession` / `resumeSession` 接入 `attachSession` | REQ-001 | high | TASK-004 | 单测通过 |
| TASK-006 | `handleSend` 用 runtime id + 4001 自动恢复重试（有界一次） | REQ-003 | high | TASK-004 | 单测通过 |
| TASK-007 | 事件过滤 / `session.interrupt` / `session.events.since` / 附件改用 runtime id | REQ-002 | high | TASK-004 | 单测通过 |
| TASK-008 | 错误文案透传（`isSessionNotFound` + message 透出） | REQ-004 | medium | TASK-006 | 单测通过 |

### Wave 2 — 验证（依赖 Wave 1）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-009 | `ChatPage.test.tsx` 新增：选中→resume→runtime 提交；事件按 runtime 渲染；4001→自动恢复 | REQ-001,REQ-002,REQ-003 | high | TASK-005,TASK-006,TASK-007 | 新用例通过 |
| TASK-010 | `npm run check` 全绿 | REQ-001..004 | high | TASK-009 | 命令退出码 0 |
| TASK-011 | 真机验证：历史会话点选→发送→可见回复 | REQ-002 | high | TASK-010 | 网关无 4001 WARN |
| TASK-012（可选, F2） | 历史消息渲染（resume.messages 或 L2 messages） | — | low | TASK-011 | 可见往期消息 |

## Traceability Matrix
| Requirement | Tasks | Coverage |
| --- | --- | --- |
| REQ-001 | TASK-000, TASK-001, TASK-004, TASK-005, TASK-009 | full |
| REQ-002 | TASK-000, TASK-003, TASK-004, TASK-007, TASK-009, TASK-011 | full |
| REQ-003 | TASK-001, TASK-006, TASK-008, TASK-009 | full |
| REQ-004 | TASK-002, TASK-008 | full |

## Dependency Graph
```
TASK-000 ─┐
TASK-001 ─┼─> TASK-002 ─> TASK-003 ─> TASK-004 ─┬─> TASK-005 ─┐
          │                                     ├─> TASK-006 ─┼─> TASK-009 ─> TASK-010 ─> TASK-011 ─> TASK-012
          │                                     └─> TASK-007 ─┘
```

## Conformance Checklist
- [ ] 每个 GEARS 需求映射到测试用例
- [ ] 无循环依赖
- [ ] 4001 恢复有界（最多一次）
- [ ] BFF 未改动
