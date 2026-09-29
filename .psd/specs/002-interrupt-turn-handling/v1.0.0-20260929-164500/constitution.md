# Project Constitution — 24H Web（对话域）

> 本文件为规格 002 的项目级约束快照；与仓库根 `AGENTS.md` 冲突时以 `AGENTS.md` 为准。

## Technology Constraints (GEARS Format)

- Where 变更涉及前端对话域，The 实现 shall 落在既有 `apps/web/src/chat/` 与 `apps/web/src/api/`，不新造框架。
- While TypeScript 处于 strict 模式，The 实现 shall 不引入 `any` 兜底，网关字段一律容错归一化。
- When 新增用户可见文案，The 实现 shall 与所在文件的既有风格一致。
- When 修改任何文件，The 提交 shall 先通过 `npm run check`。

## Process Rules

1. 变更先改 4 份基线文档（`AGENTS.md` / `requirement.md` / `ui-spec.md` / `architecture.md`）→ 更新 `task-list.md` → 再改代码。
2. 正式开发用 Spec 模式；任务顺序执行，前置未验收不得开启后继。
3. 质量门不过不进人工验收。
4. 契约以 Hermes 官方源码为准，禁止猜测内部 schema。

## Boundaries (Always / Ask / Never)

| 层级 | 条目 |
|------|------|
| ✅ Always | 用 runtime id 调会话域 RPC；错误结构统一 `{error,message}`；`npm run check` 全绿再提交 |
| ❓ Ask First | 改动 stored/runtime 身份契约；新增 BFF 路由；持久化中断态 |
| 🚫 Never | 用 stored id 充当 runtime id；把 `interrupted` 显示成「完成」；把网关真实 message 吞掉；改测试以求绿；提交 `node_modules/`、`dist/`、`.env` |
