# Project Constitution (patch v1.4.2)

## Technology Constraints (GEARS Format)
- Where 组件订阅网关事件，The 实现 shall 在 effect cleanup 中注销（`on`/`onServerRequest` 返回 `Unsubscribe`）。
- Where 需要 WebSocket 连接，The 客户端 shall 保证 `connect()` 幂等，避免多连接。

## Process Rules
- 每个订阅必须配对注销；先写复现测试再修。
- 提交前 `npm run check` 必须全绿。

## Boundaries
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | effect 注册配 cleanup；`on` 返回注销函数；`connect` 幂等 |
| ❓ Ask First | 是否引入全局单例网关 |
| 🚫 Never Do | handler 跨挂载累积；一次连接新建多个 WebSocket |
