# Tasks (patch v1.4.1)
> Spec ID: 001-chat-session-resume | Version: v1.4.1-20260929-134500 | Parent: v1.4.0

| ID | Description | REQ Link | Priority | Status |
| --- | --- | --- | --- | --- |
| TASK-017 | `ws.ts` dispatch 事件分支：将 `params.session_id`/`sessionId` 并入 handler payload（不覆盖、不改写原帧） | REQ-012 | high | 已完成 |
| TASK-018 | `ws.test.ts` 新增真实形状帧透传 + 不覆盖两条回归测试 | REQ-012 | high | 已完成 |
| TASK-019 | `npm run check` 全绿（web 293 / server 131） | REQ-012 | high | 已完成 |
| TASK-020 | 真机复验：历史会话点选→发送→**界面可见回复**；网关无 4001 WARN | REQ-012 | high | 待你验证 |

## Dependency Graph
```
TASK-017 ─> TASK-018 ─> TASK-019 ─> TASK-020
```
