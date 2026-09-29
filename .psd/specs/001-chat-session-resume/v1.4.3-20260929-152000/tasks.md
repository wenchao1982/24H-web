# Tasks (patch v1.4.3)
> Spec ID: 001-chat-session-resume | Version: v1.4.3-20260929-152000 | Parent: v1.4.2

| ID | Description | REQ Link | Priority | Status |
| --- | --- | --- | --- | --- |
| TASK-028 | `ChatPage.tsx`：`message.complete` 复位 running/status（done 保留兼容） | REQ-017,REQ-019 | high | 待实施 |
| TASK-029 | `types.ts`：message 变体加 `reasoning?`；`completeAssistant` 支持 reasoning；新增 `isReasoningOnly` | REQ-018 | high | 待实施 |
| TASK-030 | `ChatPage.tsx`：complete 时传 `isReasoningOnly(payload)` | REQ-018 | high | 待实施 |
| TASK-031 | `Transcript.tsx` + `styles.css`：渲染「思考过程」块（`data-reasoning` + 标签 + 弱化样式） | REQ-018 | high | 待实施 |
| TASK-032 | `ChatPage.test.tsx`：复位 / 思考块 / 普通回复 / done 兼容 用例 | REQ-017,REQ-018,REQ-019 | high | 待实施 |
| TASK-033 | `npm run check` 全绿 | REQ-017..REQ-019 | high | 待实施 |
| TASK-034 | 真机复验：一轮结束后输入框回到「发送」；纯推理回合显示「思考过程」 | REQ-017,REQ-018 | high | 待你验证 |

## Dependency Graph
```
TASK-028 ─┐
TASK-029 ─┼─> TASK-032 ─> TASK-033 ─> TASK-034
TASK-030 ─┤
TASK-031 ─┘
```
