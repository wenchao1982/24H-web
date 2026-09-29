# Patch Specification (v1.4.1): 事件帧 session_id 未透传导致增量全丢
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix-patch | Version: v1.4.1-20260929-134500 | Parent: v1.4.0

## 1. 背景（真机验证暴露）
按 v1.4.0 修复并部署后，真机日志显示服务器 turn 正常完成：
`tui turn finished: ui_session=0a37b493 session_key=20260928_102322_7f04bb agent_session_id=20260928_102322_7f04bb status=complete error_retained=False duration=3.0s`
以及 `Turn ended: reason=text_response(finish_reason=stop) model=deepseek-v4-flash response_len=34`。
**但界面仍不显示回复。**

## 2. 根因（源码证据）
Hermes 事件帧结构（`tui_gateway/server.py:665-668`）：
```json
{"jsonrpc":"2.0","method":"event","params":{"type":"message.delta","session_id":"<runtime id>","payload":{"text":"..."}}}
```
`session_id` 是 `params` 下与 `payload` **同级**的字段。

24H Web `apps/web/src/api/ws.ts` 的 `dispatch()` 只取 `frame.params.payload` 交给 handler，**丢弃了 `params.session_id`** → handler 收到的 payload 永远没有 `session_id` → v1.4.0 的严格过滤 `matchesRuntime(payload, runtimeId)` 恒为 false → **所有 `message.delta`/`complete`/`tool.*`/`thinking`/`done` 被丢弃**（turn 完成但界面空白）。

**为何此前"看似正常"**：v1.0.0 的 `isSameSession` 在 id 缺失时 `return !id || id === activeId`（fail-open 返回 true），恰好掩盖了该结构缺陷。v1.4.0 改为严格匹配后将其暴露。
**为何单测未捕获**：`FakeGateway.emit(type, payload)` 直接投喂带 `session_id` 的 payload，**绕过了真实 `dispatch` 的拆包**（fake-vs-real 差异）。

## 3. 期望行为
- When `GatewayClient` 收到 `method="event"` 帧，Then 交给 handler 的 payload shall 包含该帧 `params.session_id`（若 payload 自身未带 `session_id`）。
- 不得改写原帧；不得覆盖 payload 中已存在的 `session_id`。

## 4. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-012 | high | - | - | 收到 Hermes 事件帧 (`method="event"`) | GatewayClient | 将 `params.session_id` 并入交给 handler 的 payload | Given 帧 `params={type:"message.delta",session_id:"rt-1",payload:{text:"hi"}}`, When 分发, Then handler 收到 `{text:"hi",session_id:"rt-1"}`；若 payload 已有 `session_id` 则不覆盖；原帧不被修改 |

## 5. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 透传 session_id | When 分发真实形状帧 | 断言 handler payload 含 `session_id` |
| 不覆盖 | Given payload 自带 session_id | 断言保持原值 |
| 不改写原帧 | — | 断言同一 payload 对象未被复用/篡改 |

## 6. 属性测试 (Property-Based Tests)
1. **透传不变量**：对任意事件帧，若 `params.session_id` 为字符串且 payload 无 `session_id`，则 handler 收到的 payload.session_id === params.session_id。
2. **不覆盖**：若 payload 已含 `session_id`，分发后其值不变。
3. **无副作用**：分发不修改传入帧对象。

## 7. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 事件帧的 `session_id` 必须到达 handler；保持既有字段不变 |
| ❓ Ask First | 是否同时透传其它 `params` 顶层字段 |
| 🚫 Never Do | 丢弃/改写事件帧的身份字段；改 BFF 代理语义 |
