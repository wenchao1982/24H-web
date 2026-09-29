# Patch Specification (v1.4.3): turn 结束未复位 + 思考过程被当正式回复显示
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix-patch | Version: v1.4.3-20260929-152000 | Parent: v1.4.2

## 1. 背景（真机验证暴露）
- 每轮对话结束后，输入框一直停留在「停止／思考中」，永远不回到「发送」。
- 某些回合，助手气泡里显示的是**模型的思考过程**（例："The user wants exactly two characters… No thinking tags.pong"），而非正式答复。

## 2. 根因（源码/日志证据）
### A. 卡「停止」
- Hermes `tui_gateway` 中**不存在 `done` 事件**：全目录搜 `"done"` 仅 4 处（voice/TTS 状态与一个无关 payload 字段），**无任何 `_emit("done", …)`**；tui 只发 `message.delta` / `message.complete`。
- 24H Web 的 `running=false` 仅由 `done`（或 `error`）触发（`apps/web/src/chat/ChatPage.tsx:225-232`），`message.complete` 不清 running → 每轮结束都卡在「停止」。
### B. 思考过程被当回复
- Hermes 将推理走**独立事件** `reasoning.delta`（`tui_gateway/contracts/events.py:121`），`message.delta` 只带 `text/rendered/verbose`（`events.py:110-120`）。
- 但模型**只产出 reasoning、content 为空**时，Hermes 会把 reasoning 提升为最终答复（日志：`Reasoning-only clean stop (404 chars) — returning the reasoning as the final response`；`agent/turn_final_response.py:87-115`）→ `message.complete.text` 即思维链；同时 `MessageCompletePayload.reasoning`（`events.py:191`）也带上同一段文本。
- 客户端只读 `text`（`apps/web/src/chat/types.ts` `deltaText`），无从区分 → 如实渲染。

## 3. 期望行为
- When 一个 `message.complete` 到达当前会话，Then 输入框 shall 复位为「发送」（running=false）。
- When `message.complete` 的 `text` 与其 `reasoning` 相同，Then 该条 shall 渲染为「思考过程」块（区别于正式回复），不得伪装成正式答复。

## 4. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-017 | high | - | 当前会话正在运行 | 收到属于当前会话的 `message.complete` | ChatPage | 复位 running 与状态 | Given 已发送并收到 `message.complete{匹配 runtime id}`, Then composer 主按钮回到「发送」，状态为 done |
| REQ-018 | high | - | - | `message.complete` 的 `text` 与 `reasoning` 相同 | ChatPage/Transcript | 渲染为「思考过程」块 | Given `{text:"…", reasoning:"…"}`（同文）, Then 该气泡带 `data-reasoning="true"` 且显示「思考过程」标签；普通回复不带该属性 |
| REQ-019 | medium | - | - | 收到 `done` 事件（前向兼容） | ChatPage | 仍复位 running | Given 收到 `done`, Then running=false |

## 5. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 复位 | When 收到 complete | 断言主按钮名回到「发送」 |
| 思考过程块 | When text===reasoning | 断言 `data-reasoning="true"` + 标签 |
| 普通回复 | When 无 reasoning | 断言无 `data-reasoning` |
| done 兼容 | When 收到 done | 断言 running 复位 |

## 6. 属性测试 (Property-Based Tests)
1. **终态唯一**：任意一轮结束后 running 必为 false（无论走 complete 还是 done）。
2. **推理不冒充答复**：若 complete 的 text 与 reasoning 相等，则该条必带 reasoning 标记；否则必不带。
3. **无回归**：普通流式答复仍合并为单个助手气泡。

## 7. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 收到本轮 `message.complete` 即复位 running；`text===reasoning` 需标注 |
| ❓ Ask First | 是否订阅 `reasoning.delta` 实时展示思考；是否折叠/默认隐藏思考块 |
| 🚫 Never Do | 依赖不存在的 `done` 事件复位；把思考过程渲染成正式答复而不加区分 |
