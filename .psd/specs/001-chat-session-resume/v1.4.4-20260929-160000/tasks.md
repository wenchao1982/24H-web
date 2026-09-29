# Tasks (patch v1.4.4)
> Spec ID: 001-chat-session-resume | Version: v1.4.4-20260929-160000 | Parent: v1.4.3

| ID | Description | REQ Link | Priority | Status |
| --- | --- | --- | --- | --- |
| TASK-035 | `types.ts`：新增 `normalizeHistoryMessages`（user/assistant/tool，跳过 hidden/空，reasoning 标记） | REQ-020,REQ-023,REQ-024 | high | 待实施 |
| TASK-036 | `ChatPage.tsx`：`resumeSession` 返回 items；`attachSession(storedId, applyHistory)`；selectSession/深链传 true | REQ-020,REQ-021 | high | 待实施 |
| TASK-037 | `ChatPage.tsx`：发送路径改用 applyHistory=false，避免覆盖 | REQ-022 | high | 待实施 |
| TASK-038 | `ChatPage.test.tsx`：历史渲染/思考行/工具行/乱序/发送不覆盖 用例 | REQ-020..REQ-024 | high | 待实施 |
| TASK-039 | `npm run check` 全绿 | REQ-020..REQ-024 | high | 待实施 |
| TASK-040 | 真机复验：点选历史会话可见往期消息 | REQ-020 | high | 待你验证 |

## Dependency Graph
```
TASK-035 ─> TASK-036 ─> TASK-037 ─> TASK-038 ─> TASK-039 ─> TASK-040
```
