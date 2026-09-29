# 测试报告（24H Web）

> 本文件为测试报告模板 + 当前汇总。每次验收在下方「记录」区追加一行。

## 1. 当前汇总（最新）

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 + 单元测试 | `npm run check` | ✅ **400+ 用例**（server 130 / web 280）green |
| 端到端（Playwright headless） | `npm run test:e2e` | ✅ 2 通过 |
| 真实 Hermes e2e（对话 / 群聊） | 隔离环境 + 真实 `hermes serve` | ✅ 通过 |

- `npm run check` = `typecheck`（web + server + shared）+ `vitest`（server + web），一次跑两套。
- e2e 用 Playwright 自建隔离环境：临时 SQLite DB、首启 `admin`、构建并运行 BFF bundle 与 SPA，
  真实 Chromium 走登录 → 强制改密 → 主壳渲染链路；**不进 `check`**。
- 真实 Hermes e2e 覆盖对话（流式/工具/审批）与群聊（多 agent 房间）主链路。

## 2. 记录模板

| 测试项 | 模块 | 用例 | 结果 | 缺陷 | 时间 |
| --- | --- | --- | --- | --- | --- |
| 单元测试 |  |  | 通过 / 失败 |  | YYYY-MM-DD |
| 类型检查 |  |  | 通过 / 失败 |  | YYYY-MM-DD |
| e2e |  |  | 通过 / 失败 |  | YYYY-MM-DD |
| 真实 Hermes e2e |  |  | 通过 / 失败 |  | YYYY-MM-DD |

字段说明：

- **测试项**：单元测试 / 类型检查 / e2e / 真实 Hermes e2e / 冒烟。
- **模块**：`server` / `web` / `shared` / `e2e` / 整链。
- **用例**：用例文件或场景名（可写数量）。
- **结果**：`通过` / `失败` / `跳过`（附数量与命令）。
- **缺陷**：关联 issue 或描述；无则填 `—`。
- **时间**：`YYYY-MM-DD`。

## 3. 记录

| 测试项 | 模块 | 用例 | 结果 | 缺陷 | 时间 |
| --- | --- | --- | --- | --- | --- |
| 类型检查 + 单元测试 | server/web/shared | `npm run check` | 通过（400+，server 130 / web 280） | — | 2026-09-29 |
| 端到端 | e2e | `npm run test:e2e`（2 用例） | 通过 | — | 2026-09-29 |
| 真实 Hermes e2e | 整链 | 对话 / 群聊 | 通过 | — | 2026-09-29 |
