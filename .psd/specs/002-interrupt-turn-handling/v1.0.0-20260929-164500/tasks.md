# Tasks: 打断（停止）回合的收尾与呈现
> Spec ID: 002 | Version: v1.0.0-20260929-164500

## Implementation Tasks (Wave-based)

### Wave 1 — 基线文档（红线 1：先文档后代码）
| ID | Description | REQ Link | Priority | Verification |
|----|-------------|----------|----------|-------------|
| TASK-001 | `requirement.md` §3.1 增补「打断收尾」条目 | REQ-001,002 | high | 文档可读、与契约一致 |
| TASK-002 | `ui-spec.md` §3 对话增补「停止 → 已中断」呈现 | REQ-002 | high | 与实现一致 |
| TASK-003 | `architecture.md` §6 增补 `message.complete` status 枚举与 interrupt 回包 | REQ-001,002 | high | 与官方源码一致 |
| TASK-004 | `task-list.md` 新增 N16 条目 | - | high | 看板有唯一「下一步」 |

### Wave 2 — 类型与纯函数（依赖 Wave 1）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
|----|-------------|----------|----------|-------------|-------------|
| TASK-005 | `types.ts`：`ToolStatus`/`phase`/`notice.level` 扩展 `interrupted`；新增 `turnStatus` / `settleTools` | REQ-003,005 | high | TASK-004 | typecheck + 单测 |

### Wave 3 — 事件处理与渲染（依赖 Wave 2）
| ID | Description | REQ Link | Priority | Dependencies | Verification |
|----|-------------|----------|----------|-------------|-------------|
| TASK-006 | `ChatPage.tsx`：`message.complete` 按 `status` 分支（REQ-002/003/005）；`handleStop` 读回包 `status`（REQ-001）；身份守卫不变（REQ-004） | REQ-001..005 | high | TASK-005 | 组件测试 |
| TASK-007 | `ToolCard.tsx` / `StatusBar.tsx` 文案；`styles.css` notice `[data-level="interrupted"]` | REQ-002,003 | medium | TASK-006 | 快照/样式断言 |
| TASK-008 | 新增单测 + 集成测试（含 P1–P4） | REQ-001..005 | high | TASK-006 | `npm run check` |

### Wave 4 — 验收
| ID | Description | REQ Link | Priority | Dependencies | Verification |
|----|-------------|----------|----------|-------------|-------------|
| TASK-009 | `npm run check` 全绿 | NFR-004 | high | TASK-008 | 全绿输出 |
| TASK-010 | 真机：长工具（`sleep 300`）打断验收 | REQ-001,002,003 | high | TASK-009 | 截图 + 无悬挂 spinner |

## Traceability Matrix

| Requirement | Tasks | Coverage |
|-------------|-------|----------|
| REQ-001 | TASK-001, TASK-003, TASK-006, TASK-008, TASK-010 | full |
| REQ-002 | TASK-001, TASK-002, TASK-003, TASK-006, TASK-007, TASK-008, TASK-010 | full |
| REQ-003 | TASK-005, TASK-006, TASK-007, TASK-008, TASK-010 | full |
| REQ-004 | TASK-006, TASK-008 | full |
| REQ-005 | TASK-005, TASK-006, TASK-008 | full |

## Dependency Graph

TASK-001 → TASK-004
TASK-002 → TASK-004
TASK-003 → TASK-004
TASK-004 → TASK-005 → TASK-006 → TASK-007
TASK-006 → TASK-008 → TASK-009 → TASK-010

（无环；TASK-007 与 TASK-008 均只依赖 TASK-006，可并行。）

## Conformance Checklist

- [ ] 所有 GEARS 需求映射到测试用例
- [ ] 无循环依赖
- [ ] P1–P4 属性均有对应用例
- [ ] 既有 `message.complete`（无 status）用例保持通过
- [ ] 不引入新依赖
