# Project Constitution (patch v1.4.1)

## Technology Constraints (GEARS Format)
- Where 解析 Hermes 事件帧，The 客户端 shall 以官方帧结构为准（`params.session_id` 与 `payload` 同级），不得丢弃身份字段。
- Where handler 需要会话身份，The 客户端 shall 从帧的 `params.session_id` 取值，不得假设 payload 自带。

## Process Rules
- 真机验证发现的缺陷：先定位根因并出补丁规格，再改代码。
- 提交前 `npm run check` 必须全绿。

## Boundaries
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 事件帧身份字段到达 handler；保持既有字段不变 |
| ❓ Ask First | 是否透传其它 params 顶层字段 |
| 🚫 Never Do | 丢弃/改写事件帧身份字段；改 BFF 代理语义 |
