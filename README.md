# 24H Web

面向企业的**多用户 Hermes web 工作台**：自有 SPA + 自有 BFF + 官方 Hermes 后端。

## 架构

```
浏览器 SPA  →  BFF（认证/用户/租户/代理）  →  hermes serve  →  ~/.hermes
```

- 管理员在界面里管理用户与权限；普通用户只看到被授权的 agent 与会话。
- Hermes 的 token 只在 BFF 内使用，浏览器永不持有。

## 目录

```
24h-web/
├── apps/web/          # React SPA (Vite)
├── apps/server/       # BFF (Fastify)：认证 / 用户 / 代理 / 审计
├── packages/shared/   # 共享类型
├── docs/              # ARCHITECTURE.md / TASKS.md
└── .github/workflows/ # CI
```

## 快速开始

```bash
npm install

# 1) 官方后端（loopback；已安装 Hermes）
hermes serve --host 127.0.0.1 --port 9119

# 2) BFF
HERMES_BASE_URL=http://127.0.0.1:9119 npm run dev:server

# 3) SPA
npm run dev:web
```

首次启动：BFF 在无用户时引导创建 `super_admin` 并强制改密（见 `docs/TASKS.md` E2）。

## 部署（A2：loopback + 反代）

```
浏览器 ──https://域名──> [Caddy] ──> [BFF :8931]
                                        └──代理──> [hermes serve 127.0.0.1:9119]
```
- Hermes 只绑 loopback；公网只暴露 BFF（经反代 + TLS）。
- BFF 负责登录认证；`~/.hermes/.env` 权限收紧。

## 任务 / 路线

功能拆解与最小实现顺序见 [`docs/TASKS.md`](./docs/TASKS.md)。

## License

Licensed under the **Business Source License 1.1** (BUSL-1.1) — see [LICENSE](./LICENSE).
- 非生产用途可自由使用/修改/分发。
- 生产/商用需向 Licensor 获取商业许可；至 **Change Date (2030-09-27)** 自动转为 **Apache License 2.0**。
