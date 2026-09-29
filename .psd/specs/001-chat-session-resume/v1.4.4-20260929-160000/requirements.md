# Patch Specification (v1.4.4): 历史消息渲染（原 F2 / REQ-008）
> Spec ID: 001-chat-session-resume | Phase: requirements | Workflow: bugfix-patch | Version: v1.4.4-20260929-160000 | Parent: v1.4.3

## 1. 背景
用户反馈：点选历史会话后，**看不到过去的对话消息**（transcript 只显示本轮新发送的内容）。此前规格将此项标记为可选（F2 / REQ-008），现正式实现。

## 2. 契约事实（源码 + 真机实测证据）
- `session.resume` 的 `session_id` 入参是 **stored id**；回包 `session_id` 是 **runtime id**（`tui_gateway/contracts/sessions.py:174-191`）。
- `SessionResumeResult` 默认**包含 `messages`**（`contracts/sessions.py:73-98,186`）；`SessionResumeParams` 的 `omit_messages`/`defer_history` 默认均为 `false`（`methods_session.py:962` → `_resume_cold`）。
- `messages` 是**投影后的展示数据**（`tui_gateway/session_history.py:200-273`），每条形如：
  `{"role":"user|assistant|tool|system","text":str?, "timestamp":float?, "row_id":int?, "display_kind":str?, "reasoning":str?}`；
  投影会丢弃 `display_kind=="hidden"`、`[System: …]`、空行；工具行给 `name`/`context`/`args`，多数**不含结果**。
- 真机实测（stored id `20260928_102322_7f04bb`）：`message_count=19`、`messages_omitted=false`、roles `{user:9, assistant:10}`；示例
  `{"role":"assistant","text":"你好！有什么可以帮你的吗？","timestamp":…,"row_id":10,"reasoning":"The user just said …"}`。
- 风险：resume 的 `messages` 默认**无上限**；超长会话可能返回体巨大或被 `4130` 拒绝。L2 `GET /api/hermes/sessions/{stored_id}/messages` 为**分页**替代（默认 latest 500，返回**原始 DB 行**，字段为 `content`/`id`，与投影不同，不可混用）。

## 3. 期望行为
- When 用户点选/深链进入存储会话 S，Then transcript shall 显示该会话的历史 user/assistant 消息（以及历史工具卡），随后再叠加本轮实时事件。
- 历史加载 shall 受"乱序守卫"约束：仅当 S 仍为当前选中会话时才写入。
- 历史加载 shall 不影响发送路径（发送时的自动 resume 不得覆盖 transcript）。

## 4. 功能需求 (GEARS Format)
| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-020 | high | - | - | 点选/深链进入存储会话 S | ChatPage | 用 resume 回包 `messages` 渲染历史 | Given resume 返回 `messages:[{role:"user",text:"旧问"},{role:"assistant",text:"旧答"}]`, When 选中 S, Then transcript 同时显示「旧问」「旧答」 |
| REQ-021 | high | - | 用户可能在加载期间切换会话 | 历史加载返回 | ChatPage | 仅当 S 仍为当前会话时才写入 | Given 选中 A 后立即切到 B, When A 的历史返回, Then transcript 只反映 B |
| REQ-022 | high | - | 已有历史 | 用户发送新消息 | ChatPage | 不得用历史覆盖当前 transcript | Given 已渲染历史, When `handleSend` 触发内部 attach, Then 不重复追加/不覆盖已渲染项 |
| REQ-023 | medium | - | - | 历史中 `text === reasoning` 的助手行 | ChatPage | 按「思考过程」渲染 | Given 该行 text 与 reasoning 相同, Then 该条带 `data-reasoning="true"` |
| REQ-024 | medium | - | - | 历史含工具行 | ChatPage | 渲染为工具卡 | Given `{role:"tool",name:"web_search",context:"…"}`, Then 渲染工具卡（完成态） |

## 5. GEARS → GWT 映射
| GEARS Clause | GWT Equivalent | Test Verification |
| --- | --- | --- |
| 历史渲染 | Given resume.messages | 断言历史文本出现在 DOM |
| 乱序守卫 | When A 迟到 | 断言不写入 |
| 不覆盖发送 | When 发送 | 断言历史仍在且不重复 |
| 思考块 | Given text===reasoning | 断言 `data-reasoning` |
| 工具行 | Given role=tool | 断言工具卡 |

## 6. 属性测试 (Property-Based Tests)
1. **幂等**：同样的 `messages` 只渲染一次；重复 resume 不叠加。
2. **顺序保持**：渲染顺序与 `messages` 数组顺序一致。
3. **守卫**：任意切换时序下，非当前会话的历史不写入 transcript。

## 7. 边界 (Boundaries)
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 历史来源为 resume 投影；受乱序守卫；发送路径不覆盖 |
| ❓ Ask First | 超长会话是否改 `defer_history` + L2 分页；是否折叠历史 |
| 🚫 Never Do | 混用 resume 投影与 L2 原始行；在发送路径重放历史 |
