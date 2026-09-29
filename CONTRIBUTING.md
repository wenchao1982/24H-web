# CONTRIBUTING — Spec 驱动工作流快速卡片

> 一页上手：用 **Spec（规格优先）** 让 opencode 在本仓做确定性开发。
> 本仓 `opencode.json` 已挂载 `opencode-vibe-spec` 插件，并把 4 份基线文档登记为 `instructions`。

## 0. 模式选择

| 模式 | 何时用 | 说明 |
| --- | --- | --- |
| **Spec** | ✅ **主力**：正式开发 | 变更先落基线文档 → 再实现；可验收、可追溯 |
| **Plan** | 需要先出方案 | 只规划、产出计划，不改代码 |
| **Ask** | 只读问答 / 文档校验 / 代码阅读 | **不可改文件**（见下方说明） |
| **Build** | 🚑 应急修补 | 快速改一处；**事后必须补回基线文档** |
| **Vibe** | ⛔ **禁用** | 无规格即兴生成，禁止用于正式开发 |

> ⚠️ **关于 Ask**：opencode 原生只有 **Build / Plan** 两个 primary agent（Build 是默认）。
> "Ask" 并非内置；本仓在 `opencode.json` 中定义了一个**只读** primary agent
> `ask`（`permission.edit="deny"`、`bash` 需逐条确认），从而让工作流的 Ask 模式在任何情况下都存在。

## 1. 初始化

```bash
npm install                 # Node >= 20
# 4 份基线文档已在 opencode.json#instructions：
#   AGENTS.md · requirement.md · ui-spec.md · architecture.md
# 看板与报告：task-list.md · test-report.md ；部署：deploy.md
```

- 文件名统一 **`AGENTS.md`**（大写）。
- `task-list.md` / `test-report.md` / `deploy.md` **不进** `instructions`（它们是产物/看板，不是常驻规格）。

## 2. 迭代循环（Step 1–5）

1. **改基线文档**：需求 → `requirement.md`；界面 → `ui-spec.md`；架构/接口 → `architecture.md`；
   约定 → `AGENTS.md`。（接口细节同步 `docs/INTERFACES.md` / `docs/UI.md` / `docs/ARCHITECTURE.md`。）
2. **更新看板**：在 `task-list.md` 新增/调整任务行（编号、模块、描述、**前置依赖**、验收标准）。
3. **实现**：以 **Spec 模式**按任务改代码，一次一个任务；前置任务未验收不得开启后继。
4. **过质量门**：`npm run check`（typecheck + vitest）必须全绿；必要时 `npm run test:e2e`；
   把结果写进 `test-report.md`。
5. **收尾**：更新 `deploy.md`（如涉部署）与相关 `docs/*`；如用户要求再 commit。

## 3. 全局集成

- `opencode.json#instructions` 常驻注入 4 份基线，opencode 每次都会读到当前规格。
- `AGENTS.md` 顶部「红线规则」是硬约束；`docs/*` 是详细来源。
- 看板（`task-list.md`）动态更新，是"下一步做什么"的唯一入口。

## 4. 收尾清单

- [ ] 基线文档与代码一致（先文档后代码）。
- [ ] `task-list.md` 对应任务已置 `已验收`。
- [ ] `test-report.md` 已追加本次结果。
- [ ] `npm run check` 全绿（400+ 用例）。
- [ ] `deploy.md` / `docs/*` 已同步；无密钥入仓。

## 5. 红线规则

1. **变更先改 4 份基线文档 → 更新 `task-list.md` → 再改代码**。
2. **正式开发用 Spec 模式，禁用 Vibe**（应急用 Build，事后补文档）。
3. **任务顺序执行**：前置未验收，不得开启后继任务。
4. **质量门不过不进人工验收**（`npm run check` 必须绿）。
5. **每 3–5 个任务重置会话**，避免上下文污染。

## 6. 常用指令速查

| 目的 | 命令 |
| --- | --- |
| 质量门（必跑） | `npm run check` |
| 端到端 | `npm run test:e2e` |
| 构建 | `npm run build` |
| dev（后端/前端） | `npm run dev:server` · `npm run dev:web` |
| 上线冒烟（只读） | `OS_SMOKE_BASE=... OS_SMOKE_USER=... OS_SMOKE_PASS=... npm run smoke` |

## 7. 避坑清单

- ❌ 别把 `task-list.md` / `test-report.md` / `deploy.md` 塞进 `instructions`。
- ❌ 别用 `todowrite` 代替 VibeLoop 的 `vl_task_*`（本仓启用 VibeLoop）。
- ❌ 别先写代码后补规格；顺序必须"文档 → 看板 → 代码"。
- ❌ 别在会话里连做太多任务；**每 3–5 个任务重置会话**。
- ❌ 别在 Ask 模式改文件（该 agent 已 `edit: deny`）。
- ⚠️ 根文件是**精简入口**，细节一律**链接到 `docs/*`**，避免双份维护漂移。
