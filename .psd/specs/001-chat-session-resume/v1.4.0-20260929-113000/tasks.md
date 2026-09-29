# Tasks: Bugfix 001-chat-session-resume
> Spec ID: 001-chat-session-resume | Phase: tasks | Version: v1.4.0-20260929-113000 | Parent: v1.3.0

## 实施任务（Wave-based）

### Wave 0 — 基线文档（红线 §11）
| ID | Description | REQ Link | Priority | Verification |
| --- | --- | --- | --- | --- |
| TASK-000 | `architecture.md`：身份对模型 + §2 契约矩阵（附行号，含 create 双字段与 runtime id 形态） | REQ-001,REQ-002,REQ-006 | high | 文档评审 |
| TASK-001 | `requirement.md`/`ui-spec.md`：点选即 attach、4001 有界恢复、身份矩阵、`workspace.move` 用 `session_key`、逐行隔离、终止事件兜底 | REQ-001,REQ-002,REQ-003,REQ-004,REQ-009,REQ-011 | high | 文档评审 |
| TASK-002 | `task-list.md`：登记本修复（建议 N15） | REQ-001..REQ-011 | medium | 看板可见 |

### Wave 1 — 代码
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-003 | `types.ts`：`normalizeResumedId`（仅 `session_id`）、`normalizeCreatedIdentity`、`matchesRuntime`（含 camelCase 回退）+ 单测 | REQ-001,REQ-002,REQ-006,REQ-011 | high | TASK-002 | 单测通过 |
| TASK-004 | `ws.ts`：rejection 带 `code` + `isSessionNotFound` + 单测 | REQ-003 | high | TASK-002 | 单测通过 |
| TASK-005 | `ChatPage`：`SessionIdentity`/`identityRef`/`activeIdRef`/`attachInFlightRef` + `activePair`/`resumeRuntime`/`attachSession` | REQ-001,REQ-005 | high | TASK-003,TASK-004 | 单测通过 |
| TASK-006 | `selectSession` 同步清空 + attach；`onResume` 改为等价点选（删除旧 `resumeSession`）；`?session=` 深链同路径 | REQ-001,REQ-007,REQ-010 | high | TASK-005 | 单测通过 |
| TASK-007 | `createSession`：`normalizeCreatedIdentity` 写身份对与列表项 id（含 ID-3 守卫，零 resume） | REQ-006 | high | TASK-005 | 单测通过 |
| TASK-008 | `handleSend`：`activePair` 门控 + 4001 以发送时 storedId 有界重试 + 切换丢弃 | REQ-002,REQ-003 | high | TASK-005 | 单测通过 |
| TASK-009 | 事件过滤 `matchesRuntime`；`events.since` 依赖/早退；无 id 终止事件清 running | REQ-002,REQ-005,REQ-011 | high | TASK-005 | 单测通过 |
| TASK-010 | 身份矩阵：`session.title`（T===A 复用、否则临时 resume）/`interrupt`/`file`+`image`+`pdf`+`clipboard`.attach/`subagent.*` 用 runtime id；`workspace.move` 用 `session_key`；`delete`、`resume` 入参用 stored id | REQ-002,REQ-009 | high | TASK-005 | 单测通过 |
| TASK-011 | 错误文案透传（归一化失败 / 重试失败 / identity 为空提示） | REQ-004 | medium | TASK-008 | 单测通过 |
| TASK-012 | 测试辅助：`fakeGateway` 默认 `session.resume`/`session.create` 应答（仅在 handler 未给出非空结果时生效） | REQ-001,REQ-006 | high | TASK-005 | 既有用例可运行 |

### Wave 2 — 验证
| ID | Description | REQ Link | Priority | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| TASK-013 | 订正既有断言（含 `create` 用例补 `stored_session_id`、`resume` 入参保持 stored、`workspace.move`→`session_key`）+ 新用例（身份对/矩阵/4001/归一化失败/乱序/create 双 id/深链/无 id 终止事件/逐行隔离/T===A 重命名） | REQ-001..REQ-011 | high | TASK-006,TASK-007,TASK-008,TASK-009,TASK-010,TASK-011,TASK-012 | 全部用例通过 |
| TASK-014 | `npm run check` 全绿 | REQ-001..REQ-011 | high | TASK-013 | 退出码 0 |
| TASK-015 | 真机：历史会话点选→发送→回复；重命名非活动行；移动工作区；网关无 4001 WARN | REQ-002,REQ-003,REQ-009 | high | TASK-014 | 观察到回复 |
| TASK-016 | （可选 F2）历史消息渲染 | REQ-008 | low | TASK-015 | 可见往期消息 |

## Traceability Matrix
| Requirement | Tasks | Coverage |
| --- | --- | --- |
| REQ-001 | TASK-000, TASK-001, TASK-002, TASK-003, TASK-005, TASK-006, TASK-012, TASK-013 | full |
| REQ-002 | TASK-000, TASK-001, TASK-003, TASK-008, TASK-009, TASK-010, TASK-013, TASK-014, TASK-015 | full |
| REQ-003 | TASK-001, TASK-004, TASK-008, TASK-011, TASK-013, TASK-014, TASK-015 | full |
| REQ-004 | TASK-001, TASK-011 | full |
| REQ-005 | TASK-002, TASK-005, TASK-009, TASK-013, TASK-014 | full |
| REQ-006 | TASK-000, TASK-002, TASK-003, TASK-007, TASK-012, TASK-013, TASK-014 | full |
| REQ-007 | TASK-002, TASK-006, TASK-013, TASK-014 | full |
| REQ-008 | TASK-016 | optional |
| REQ-009 | TASK-001, TASK-002, TASK-010, TASK-013, TASK-015 | full |
| REQ-010 | TASK-002, TASK-006, TASK-013 | full |
| REQ-011 | TASK-001, TASK-002, TASK-003, TASK-009, TASK-013 | full |

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
TASK-008 ─> TASK-011 ─> TASK-013
```

## Conformance Checklist
- [ ] 每个 GEARS 需求映射到测试与任务
- [ ] DAG 无环，TASK-011 进入验证链（→TASK-013）
- [ ] 身份对不变式 ID-1..ID-6 均有守卫
- [ ] `normalizeResumedId` 不接受 `id`；fail-open 不可达
- [ ] 无跨会话 runtime-id RPC；逐行操作不改写 identity
- [ ] `session.create` 双字段已接线；`workspace.move` 用 `session_key`；`resume` 入参用 stored
- [ ] 身份矩阵每条均有源码证据（含 image/pdf/clipboard attach）
- [ ] 既有断言已订正（含 create 用例补 `stored_session_id`）
- [ ] 无 id 终止事件清 running
- [ ] BFF 未改动
