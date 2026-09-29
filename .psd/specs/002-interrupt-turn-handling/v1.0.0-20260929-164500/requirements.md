# Specification: 打断（停止）回合的收尾与呈现
> Spec ID: 002 | Phase: requirements | Workflow: requirements-first | Version: v1.0.0-20260929-164500

## 1. Business Background

24H Web 对话页在回合运行中把主操作切换为「停止」，并以 **runtime id** 调 `session.interrupt`。真机日志（`status=interrupted`、`response_len=0`）与 Hermes 官方源码核对后确认两个前端缺陷：

- **G1 悬挂工具卡**：打断中途被 abandon 的工具不保证再收到 `tool.complete`；`message.complete` 处理器不结算仍处于 `start`/`generating` 的工具卡 → 运行指示永久残留。
- **G2 状态误报**：`message.complete` 处理器无条件 `setStatus({phase:"done"})`，打断后状态栏显示「完成」。

同时缺失「已中断」的可见反馈，用户无法判断停止是否生效。

本规格关闭 G1、G2，并补上中断的可见反馈；不改变既有身份对（stored/runtime）契约。

## 2. User Stories

- 作为用户，我想在长工具运行中点「停止」后立刻看到明确结果（已中断、无残留 spinner），以便确认停止生效。
- 作为用户，我想被中断的回合保留已经生成的部分文本，以便不丢失已有内容。
- 作为用户，我想在会话身份未就绪时点「停止」不会发出错误请求，以便不产生无意义的网关错误。

## 3. Functional Requirements (GEARS Format)

| ID | Priority | Where/Static | While/Stateful | When/Trigger | Subject | Response (shall) | Acceptance Criteria |
|----|----------|-------------|----------------|-------------|---------|------------------|---------------------|
| REQ-001 | high | 存在已提交的身份对且 storedId === activeId | 回合运行中 | 用户点按「停止」 | 对话页 | 以 runtime id 发出 `session.interrupt`，并接受回包 `{status:"interrupted"\|"not_interrupted"}`；回包或随后的 `message.complete` 之后主操作复位为「发送」 | Given 运行中且身份就绪，When 点按停止，Then 恰好发出一次 `session.interrupt {session_id: runtimeId}`；Given 回包到达，Then 主操作为「发送」且不再显示「停止」 |
| REQ-002 | high | 活动会话 | - | `message.complete` 的 `status` 为 `interrupted` | 对话页 | 向 transcript 追加一条「已中断」提示，并把状态相位置为 `interrupted`；不得显示「完成」 | Given 活动会话收到 `{status:"interrupted"}`，When 事件被处理，Then transcript 出现文案「已中断」且状态栏标签为「已中断」，不为「完成」 |
| REQ-003 | high | 活动会话 | - | 收到 `message.complete`（任意 status） | 对话页 | 把所有仍处于 `start` 或 `generating` 的工具卡结算为终态（`interrupted` 或 `complete`），不得残留运行指示 | Given 存在 `generating` 工具卡，When 收到 `{status:"interrupted"}` 的 `message.complete`，Then 该卡状态不再是 `start`/`generating`，界面无运行指示 |
| REQ-004 | medium | 身份对缺失或 storedId !== activeId | - | 用户点按「停止」 | 对话页 | 不发出任何 RPC，也不产生错误提示 | Given 身份未就绪，When 点按停止，Then `session.interrupt` 调用次数为 0 且无错误消息 |
| REQ-005 | medium | 活动会话 | 已有流式助手气泡 | `message.complete` 的 `status` 为 `interrupted` 且 `text` 为空 | 对话页 | 保留该气泡已累积的文本、将其结束流式；不得清空、不得新增空气泡 | Given 流式气泡文本为「你好」，When 收到 `{status:"interrupted", text:""}`，Then 该气泡仍为「你好」且 `streaming` 为 false，气泡总数不变 |

## 4. Non-Functional Requirements

| ID | 要求 |
|----|------|
| NFR-001 | 纯前端事件处理，不引入新状态库、不引 UI 库；沿用既有 `ChatPage` 事件订阅风格 |
| NFR-002 | 不改变 stored/runtime 身份契约；runtime-id RPC 的前置守卫（`activePair()`）保持 |
| NFR-003 | 文案风格与所在文件一致（`ToolCard.tsx` / `StatusBar.tsx` 现为硬编码中文，`ChatPage.tsx` 混用） |
| NFR-004 | 既有用例必须全绿（`npm run check`） |
| NFR-005 | 事件处理必须幂等：重复的 `message.complete` 不得产生第二个气泡或第二条提示 |

## 5. Property-Based Test Properties

| ID | 不变量 | 覆盖边界 |
|----|--------|----------|
| P1 | 同一 `message.complete` 处理两次，transcript 长度与状态相位的增量不超过一次 | 重复事件、StrictMode 双订阅 |
| P2 | 任意时刻收到 `message.complete` 之后，`items` 中不存在 `status ∈ {start, generating}` 的工具卡 | 全部三种 status、无工具卡、多张工具卡 |
| P3 | 非活动会话（runtime id 不匹配）的 `message.complete` 不改变活动会话的 `running` / `status` / `items` | 并发双会话 |
| P4 | `status` 缺失或为未知值时按 `complete` 处理（向后兼容旧网关） | `undefined`、`""`、`"settled"` |

## 6. Boundaries

| 层级 | 条目 |
|------|------|
| ✅ Always Do | 用 runtime id 调 `session.interrupt`；`message.complete` 必复位 `running`；结算悬挂工具卡；保留被打断回合的部分文本 |
| ❓ Ask First | 是否把「已中断」持久化到会话（本规格不持久化，交给网关 resume 决定） |
| 🚫 Never Do | 不用 stored id 调 `session.interrupt`；不把 `interrupted` 显示成「完成」；不在身份未就绪时发 RPC；不吞掉网关真实 message；不改测试来让质量门通过 |

## GEARS → GWT Mapping

| GEARS Clause | GWT Equivalent | Test Verification |
|-------------|----------------|-------------------|
| Where 存在已提交的身份对 | Given 身份就绪 | 断言 RPC 参数为 runtime id |
| While 回合运行中 | Given 输入区处于「停止」态 | 断言初始主操作为「停止」 |
| When 点按「停止」 | When click 停止 | `gateway.paramsOf("session.interrupt")` |
| When `status` 为 `interrupted` | When emit `message.complete` | 断言提示文案 + 状态标签 |
| shall 结算工具卡 | Then 无运行指示 | 断言 `resolvedTools` 不含开始/生成中 |
