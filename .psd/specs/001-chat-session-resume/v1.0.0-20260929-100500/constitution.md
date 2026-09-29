# Project Constitution (spec 001-chat-session-resume)

## Technology Constraints (GEARS Format)
- Where 代码位于 `apps/web`，The 实现 shall 使用 React 19 + TypeScript strict，且不引入 UI 库。
- Where 需要调用 Hermes，The 客户端 shall 仅通过 `apps/web/src/api/ws.ts` 的 `Gateway` 接口，不直连 Hermes。
- Where 需要确认字段，The 实现 shall 以官方契约 (`docs/INTERFACES.md` / Hermes `tui_gateway/contracts`) 为准，不得猜测 schema。
- While 处理 session-scoped RPC，The 实现 shall 使用运行时 id (runtime id)。

## Process Rules
- 变更先改基线文档（`architecture.md` / `requirement.md` / `ui-spec.md`）→ 更新 `task-list.md` → 再改代码。
- 提交前 `npm run check` 必须全绿。
- 一个任务一次只标记一个 in_progress；前置未验收不得开启后继。
- 每 3–5 个任务重置会话。

## Boundaries
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | session-scoped RPC 前确保已 attach；事件过滤用运行时 id；错误信息透传；保持 BFF 透明 |
| ❓ Ask First | `session.resume` 的 lazy/defer_history/omit_messages 选项；历史消息渲染；是否新增依赖 |
| 🚫 Never Do | 用存储 id 调 `prompt.submit`；无限重试；修改 BFF 代理语义；在日志/前端暴露 token/口令 |
