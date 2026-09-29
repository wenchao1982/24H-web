# Patch Specification (v1.4.2): StrictMode 双注册导致重复助手气泡 / 多 WebSocket
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix-patch | Version: v1.4.2-20260929-145000 | Parent: v1.4.1

## 1. 背景（真机界面上观察到）
修复 v1.4.1 后，真机对话可正常显示回复，但界面出现**两条文字完全相同的助手气泡**（同一轮回复）。

## 2. 根因（有失败测试为证）
复现测试 `apps/web/src/chat/ChatPage.strictmode.test.tsx`（StrictMode 包裹）失败：
```
× StrictMode：一个 message.complete 事件只应产生一个助手气泡
  → message.complete 注册次数: expected 2 to be 1
  → 助手气泡: ['你好，世界', '你好，世界'] length expected 1 but got 2
✓ 对照组（无 StrictMode）通过
```
因果链：
1. `apps/web/src/main.tsx:9` 使用 `<StrictMode>`；React dev 下 effect **双跑**（mount→cleanup→mount）。
2. `apps/web/src/chat/ChatPage.tsx:167-249` 用 `gateway.on(...)` 注册 8 个事件 handler，**未返回 cleanup**；`apps/web/src/api/ws.ts:13-19` 的 `Gateway` 接口**没有 `off`/unsubscribe** → 首个 handler 永久留在 `Set` 中。
3. 一个 `message.complete` 被派发两次：第 1 次封口流式气泡；第 2 次末尾已非 streaming → `apps/web/src/chat/types.ts` `completeAssistant` 兜底分支**追加重复气泡**。
4. 附带：`ChatPage.tsx:112` 与 `:138` 各调用一次 `gateway.connect()`（StrictMode 下共 4 次），`GatewayClient.connect()`（`ws.ts:54-72`）**无幂等 guard** → 多次 `new WebSocket`，旧 socket 与其监听器泄漏。
5. 同样缺陷存在于 `apps/web/src/notifications/NotificationsProvider.tsx:63,79`（`onServerRequest`/`on` 无 cleanup）。

注：`message.delta` 亦被双份应用，但 `completeAssistant` 以最终文本覆盖，故可观察症状是「重复气泡」而非文字翻倍。生产构建（无 StrictMode 双跑）不会触发第 2 步，但第 4 步（双 connect→双 WebSocket）在生产同样存在。

## 3. 期望行为
- When 组件卸载或 effect 重跑，Then 其注册的 handler shall 被注销（无累积）。
- When `connect()` 被多次调用，Then The client shall 复用同一连接，不新建多个 WebSocket。
- When 一个 `message.complete` 事件到达，Then 恰好产生一个助手气泡。

## 4. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-013 | high | - | - | 调用 `Gateway.on` / `onServerRequest` | Gateway | 返回可注销函数，注销后不再收到该 handler 回调 | Given 注册后调用返回的 unsubscribe, When 派发事件, Then handler 不被调用；未注销时被调用一次 |
| REQ-014 | high | - | 已存在连接或连接进行中 | 再次调用 `connect()` | GatewayClient | 复用既有连接，不新建 WebSocket | Given 已 connect, When 再调 connect, Then 仅存在一个 WebSocket 实例 |
| REQ-015 | high | - | React StrictMode（dev 双跑 effect） | 一个 `message.complete` 到达 | ChatPage | 恰好产生一个助手气泡 | Given StrictMode 包裹, When 选中会话并各派发一次 delta 与 complete, Then 助手气泡数 == 1 且文本不重复 |
| REQ-016 | medium | - | - | 组件卸载 / effect 重跑 | ChatPage / NotificationsProvider | 注销其注册的 handler | Given 卸载后重新挂载, When 派发事件, Then handler 不被累积调用 |

## 5. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 可注销 | When 调用 unsubscribe | ws.test.ts 断言 handler 不再被调用 |
| 连接复用 | When 二次 connect | ws.test.ts 断言 socket 实例数 == 1 |
| 单气泡 | When StrictMode + 一次 complete | ChatPage.strictmode.test.tsx 断言气泡数 == 1 |
| 卸载注销 | When 卸载/重挂 | ChatPage.strictmode.test.tsx 断言注册次数 == 1 |

## 6. 属性测试 (Property-Based Tests)
1. **注册守恒**：任意挂载/卸载序列后，某 type 的 handler 数量不超过当前挂载组件数。
2. **连接唯一**：任意次 `connect()` 后，WebSocket 实例数 <= 1。
3. **完成幂等**：对同一轮，重复派发 `message.complete` 不产生重复气泡（因 handler 不再重复；且存在卸载注销）。

## 7. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | effect 注册必配 cleanup；`on` 返回可注销函数；`connect` 幂等 |
| ❓ Ask First | 是否改为全局单例网关 |
| 🚫 Never Do | 让 handler 跨挂载累积；同一次 connect 新建多个 WebSocket |
