# Project Constitution (patch v1.4.4)

## Technology Constraints (GEARS Format)
- Where 渲染会话历史，The 实现 shall 使用 `session.resume` 回包的投影 `messages`，不得混用 L2 原始行。
- Where 写入历史，The 实现 shall 受乱序守卫约束，且不在发送路径写入。

## Process Rules
- 以契约与真机实测为依据，不猜字段。
- 提交前 `npm run check` 必须全绿。

## Boundaries
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 历史来源为 resume 投影；乱序守卫；发送路径不覆盖 |
| ❓ Ask First | 超长会话改 `defer_history` + L2 分页；历史折叠 |
| 🚫 Never Do | 混用两种历史形状；发送时重放历史 |
