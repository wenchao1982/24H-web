# Design Draft（Gate 2 确认记录）: 对话页重构

> Spec ID: 003-composer-redesign | Phase: design-draft | Version: v1.0.0-20260929-173000
> 状态：**已获用户确认**（4 节 + 2 项新待决项）
> 说明：本文件是 Gate 2（DESIGN CONFIRM）的确认记录；**正式设计见同目录 `design.md`**。

## 确认记录

| 节 | 内容 | 用户结论 |
|----|------|---------|
| 1/4 | 组件架构与状态归属（ChatPage 持会话运行时 / `useSessionControls` 持控件域 / `Composer` 持草稿；`deriveComposerVariant` 纯函数；**禁止条件渲染两个组件**） | 确认 |
| 2/4 | 技术选型（上传维持 base64-over-WS / 状态用 `useReducer` / **不复用** `settings/model.ts`）+ 数据模型（`ModelCatalog` / `PendingAttachment` + `previewUrl` 4 时机 revoke） | 确认 |
| 3/4 | 序列图（hero 延迟绑定 / 模型三态 / WS 守卫帧分类 / 工作区双路径）+ 错误处理矩阵 | 确认 |
| 4/4 | 安全（守卫插入点与帧分类判据 / `profiles.list` 泄漏 / 前端白名单非边界）+ 6 处需求订正 + 测试策略 | 确认 |

## 6 处需求订正（已采纳）

| # | 原表述 | 订正 |
|---|--------|------|
| 1 | REQ-010 的 `session.info.display_model` | → **`session.info.model`**（契约无 `display_model`；pending 值并入 `model`，`contracts/common.py:63-99` / `server.py:2233`） |
| 2 | REQ-006 未写明 attach 的 RPC 与参数 | 明确为 `image.attach_bytes{content_base64, filename}` / `file.attach{data_url, name}` / `pdf.attach{content_base64, filename}`；**禁止** `image.attach{path}` |
| 3 | NFR 的「`corner-shape` 超椭圆回退」 | **删除**（代码中不存在）→ 改为「圆角一律 `--ds-radius-*`」；基线漂移列入 Wave 0 订正 |
| 4 | REQ-014 与既有 `handleSend` 自动 resume 语义冲突 | 收敛为 `identityReady===false` 时禁用 + 本地拦截；**保留** docked 已有会话的 4001 有界重试不变 |
| 5 | 缺少菜单无障碍要求 | **新增 REQ-016**：APG Menu Button（`aria-haspopup`/`aria-expanded`/`role="menuitem"`/`Esc` + 焦点归还）。原因：既有 `SessionList` 菜单是半成品，REQ-004 会继承缺陷 |
| 6 | 上传校验落点未定 | 登记为风险 **R10** + 边界 `Q-005`；规范要求服务端 magic bytes 校验，客户端 `File.type` 仅作 UX 预筛 |

## 2 项新待决项（已拍板）

| # | 问题 | 用户选择 | 结果 |
|---|------|---------|------|
| 1 | `profiles.list` 租户元数据泄漏（`methods_profiles.py:266-285` 不按调用者过滤；`AgentsPage.tsx:90`/`GroupChatPage.tsx:66` 已在用；REQ-008 守卫覆盖不到，因该帧无 `params.profile`） | **A** | 纳入为 **REQ-015**，BFF 在**响应方向**按 `user_profiles` 白名单过滤；排 **Wave 5**，不阻塞 UI 验收 |
| 2 | REQ-008 的命名错误码在客户端不可见（`ws.ts:112-119` 只读 `error.code`(number) + `message`） | **A** | 扩展 `ws.ts` 读取 `error.data.code` 字符串（约 5 行），使 `PROFILE_FORBIDDEN` 可断言 |

## 由设计阶段产生的实现级约束（已并入 `constitution.md`）

1. `Composer` 必须**单实例** + `data-variant` 切布局（N-009）。
2. `MenuButton` 作为共享 APG 原语（A-004），供 `＋` / `···` / 三个 pill 复用。
3. WS 守卫的帧分类判据（请求 / 响应 / 通知 / 非 JSON），响应帧必须放行（N-006）。
4. 圆角只用 `--ds-radius-*`（TC-003）。
5. 不改 `settings/model.ts`（N-011）；不改既有 aria-label 与 class 名（N-012）。

---
