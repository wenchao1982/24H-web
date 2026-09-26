# 24H Web

面向中文用户的 Hermes **web 端**（route 3）：自有 SPA，由官方 `hermes dashboard` 托管，直连官方后端 L1/L2。

- **L1**：`/api/ws`（tui_gateway JSON-RPC）— 对话、会话、事件
- **L2**：`/api/*`（REST）— 配置、Keys、模型、技能

## 开发

```bash
npm install
# 另开一个终端跑官方 dashboard（默认 9119），Vite 会把 /api 代理过去
hermes dashboard --host 127.0.0.1 --port 9119
npm run dev
```

## 构建 / 部署（由官方 dashboard 托管，无需自研后端）

```bash
npm run build   # → dist/
HERMES_WEB_DIST=$(pwd)/dist hermes dashboard --skip-build --host 0.0.0.0 --port 9119
```

> 注意：必须用 `hermes dashboard`（`hermes serve` 是 headless，不挂 SPA）。
> 非回环绑定会强制 auth gate，需先配置 basic / OAuth / OIDC。

## 现状

最小闭环：设置填 Key → 对话流式。后续：技能/任务/用量整合、命令面板、移动端。
Skill UI 宿主协议**暂不实现**（规格见 `24OS/docs/SKILL_UI_PROTOCOL.md`）。

## License

Licensed under the **Business Source License 1.1** (BUSL-1.1) — see [LICENSE](./LICENSE).

- You may use, copy, modify, and redistribute this software for **non-production** purposes.
- Commercial / production use requires a commercial license from the Licensor until the **Change Date (2030-09-27)**, after which the license converts to **Apache License 2.0**.
