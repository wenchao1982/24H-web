# Tasks (patch v1.4.2)
> Spec ID: 001-chat-session-resume | Version: v1.4.2-20260929-145000 | Parent: v1.4.1

| ID | Description | REQ Link | Priority | Status |
| --- | --- | --- | --- | --- |
| TASK-021 | `ws.ts`：`on`/`onServerRequest` 返回 `Unsubscribe`；`connect` 幂等（connectPromise） | REQ-013,REQ-014 | high | 待实施 |
| TASK-022 | `fakeGateway.ts`：`on`/`onServerRequest` 返回可注销函数 | REQ-013 | high | 待实施 |
| TASK-023 | `ChatPage.tsx`：两个 effect 收集 unsubscribe 并在 cleanup 注销 | REQ-015,REQ-016 | high | 待实施 |
| TASK-024 | `NotificationsProvider.tsx`：同上 cleanup | REQ-016 | medium | 待实施 |
| TASK-025 | `ChatPage.strictmode.test.tsx` 由失败转通过；`ws.test.ts` 新增连接唯一 + 注销两组用例 | REQ-013,REQ-014,REQ-015 | high | 待实施 |
| TASK-026 | `npm run check` 全绿 | REQ-013..REQ-016 | high | 待实施 |
| TASK-027 | 真机复验：一轮回复只出现**一个**助手气泡 | REQ-015 | high | 待你验证 |

## Dependency Graph
```
TASK-021 ─┬─> TASK-022 ─> TASK-025 ─> TASK-026 ─> TASK-027
          ├─> TASK-023 ──┘
          └─> TASK-024 ──┘
```
