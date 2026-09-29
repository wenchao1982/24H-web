# Project Constitution (spec 001-chat-session-resume)

## Technology Constraints (GEARS Format)
- Where 代码位于 `apps/web`，The 实现 shall 使用 React 19 + TypeScript strict，且不引入 UI 库。
- Where 需要调用 Hermes，The 客户端 shall 仅通过 `apps/web/src/api/ws.ts` 的 `Gateway` 接口。
- Where 需要确认字段，The 实现 shall 以 Hermes `tui_gateway/contracts` 与 `docs/INTERFACES.md` 为准，不得猜测 schema。
- While 处理 session-scoped RPC，The 实现 shall 使用身份对 `{storedId, runtimeId}`，且 `runtimeId` shall 来自 `session.resume`/`session.create` 回包。
- Where resume 回包无法归一化出 runtime id，The 实现 shall 报错；不得回退为 stored id。
- While 会话已 attach，The 实现 shall 仅在 `identity.storedId === activeId` 时发出 session-scoped RPC。

## Process Rules
- 变更先改基线文档（`architecture.md`/`requirement.md`/`ui-spec.md`）→ 更新 `task-list.md` → 再改代码。
- 提交前 `npm run check` 必须全绿。
- 一次只标记一个 in_progress；前置未验收不得开启后继。
- 每 3–5 个任务重置会话。

## Boundaries
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 用身份对寻址；提交前同步清空；严格事件过滤；错误透传；并发 attach 去重 |
| ❓ Ask First | `session.resume` 的 lazy/defer_history/omit_messages；历史消息渲染；新增依赖 |
| 🚫 Never Do | 归一化失败回退 stored id；用存储 id 调 `prompt.submit`/`session.title`/`subagent.list`；向非当前会话的 runtime id 发送 RPC；无限重试；修改 BFF 代理语义；暴露 token/口令 |
