# 契约证据（contracts-evidence）

> Spec ID: 003-composer-redesign | Version: v1.0.0-20260929-173000
> 用途：把本 Spec 安全/模型/会话判据所依赖的官方契约片段**逐条归档**，使判定可被仓库/CI 独立复核（风险 R17 / R23 / R14）。
> 来源根：`/vol1/@apphome/trim.openclaw/data/home/hermes-desktop/home/hermes-agent/tui_gateway/`
> 行号快照：`2026-09-30`（源码在仓库外，行号可能随上游变动；方法/字段名与结构为准）。
> 校验方式：`grep -n` 上述根下 `contracts/*.py`；本文件每条均给出 `文件:行`。

## 0. 判定总览

| 判据 | 结论 | 依据 |
|---|---|---|
| WS request 是否需 profile 守卫 / 注入 | 参数类**声明了 `profile`** → 可守卫/须注入；**未声明** → 豁免 | `contracts/base.py:32-35`（`Params` 的 `extra="forbid"`）+ 各参数类字段 |
| 豁免清单是否可机械派生 | 是：豁免集合 == 「参数类未声明 `profile` 字段的方法集合」 | §4 全表（26 条豁免 / 211 条声明了 `profile`）；§4.3 MethodSweep 核验（2026-09-30） |
| `_SessionScoped` 方法能否用 profile 守卫 | **不能**（schema 无 `profile`，注入即 4000）；R24 以 **session 归属校验**闭合（§6） | `contracts/tools_mcp_plugins.py:19-23` |
| 模型对齐来源 | **`model.options{profile, session_id}` 回包的 `model`/`provider`**；无 `session.info` RPC | `contracts/config_free_tier_control.py:216-280`；§3.5 |

---

## 1. `session.create` 参数

来源：`contracts/sessions.py:118-147`

```python
118: class SessionCreateParams(ProfileParams):   # ProfileParams → profile: str | None = None（common.py:228-231）
119:     cols: int | None = None
120:     source: str | None = None
121:     cwd: str | None = None
122:     # #52589: provenance for ``cwd`` — true only for a deliberate workspace pick;
123:     # an inherited app-global workspace must yield to a named profile's terminal.cwd.
124:     cwd_explicit: bool | None = None
125:     messages: list[SeedMessage] | None = None
126:     parent_session_id: str | None = None
127:     title: str | None = None
128:     model: str | None = None
129:     provider: str | None = None
130:     reasoning_effort: str | None = None
131:     fast: bool | None = None
132:     close_on_disconnect: bool = False
133:     hidden: bool = False
134:     room_plumbing: bool = False
135:     follow_profile_config: bool = False
136:
138: class SessionCreateResult(Result):
139:     session_id: str            # runtime id
140:     stored_session_id: str     # stored id
141:     message_count: int
142:     messages: list[TranscriptMessage]
143:     info: SessionLiveInfo
144:
146: method("session.create", params=SessionCreateParams, result=SessionCreateResult, ...)
```

| 事实 | 值 | 行 |
|---|---|---|
| `cwd` | `str \| None = None` | `sessions.py:121` |
| `cwd_explicit` doc | “true only for a deliberate workspace pick” | `sessions.py:122-124` |
| `model` | `str \| None = None` | `sessions.py:128` |
| 无 `confirm_expensive_model` 字段 | 参数类未声明 → hero 路径无前端二次确认（REQ-011a / R13'） | 全类字段 `sessions.py:118-135` |
| 回包身份 | `session_id`=runtime、`stored_session_id`=stored | `sessions.py:139-140` |

`ProfileParams` 声明了 `profile`（`contracts/common.py:228-231`）→ **非 super_admin 的 `session.create` 缺 `profile` 须注入 `default_profile`**（REQ-017）。

---

## 2. `config.set`：`deferred` / `confirm_required`

来源：`contracts/config_free_tier_control.py:74-107`

```python
74: class ConfigSetParams(ProfileParams):
79:     key: str
80:     value: JsonValue = ""
81:     session_id: str | None = None
82:     scope: str | None = None
83:     confirm_expensive_model: bool = False
84:
86: class ConfigSetResult(Result):
87:     """... model switches add ``warning`` /
88:     ``confirm_required`` / ``confirm_message`` / ``scope`` / ``deferred`` ..."""
92:     key: str
93:     value: str | bool | None = None
95:     confirm_required: bool | None = None
96:     confirm_message: str | None = None
97:     scope: str | None = None
98:     deferred: bool | None = None
             ...
106: method("config.set", params=ConfigSetParams, result=ConfigSetResult, ...)
```

| 事实 | 行 |
|---|---|
| 入参 `key` / `value` / `session_id` / `scope` / `confirm_expensive_model` | `config_free_tier_control.py:79-83` |
| 回包 `confirm_required` / `confirm_message` / `deferred` / `scope` | `config_free_tier_control.py:95-98` |
| `ConfigSetParams(ProfileParams)` → 声明 `profile`，须注入 | `config_free_tier_control.py:74` |

补充（运行中切模型语义，design §2.2 依据）：`methods_config_set.py` 把运行中模型切换 stash 到下一回合（`deferred`），turn start 应用/丢弃。会话级 key 集合含 `yolo`：`methods_config_set.py:478`（`_SESSION_SCOPED_KEYS = {"model","fast","yolo","reasoning"}`）；`yolo` setter 接受布尔词 `on/off/1/0`（`server.py:1772-1774` `_BOOL_WORDS`；`methods_config_set.py:263-288`）。

---

## 3. `model.options` 结构

来源：`contracts/config_free_tier_control.py:216-280`

```python
216: class ModelOptionsParams(ProfileParams):
217:     session_id: str | None = None
218:     explicit_only: bool = False
219:     include_unconfigured: bool = False
220:     refresh: bool = False
238: class ModelCapabilities(Result):
241:     fast: bool
242:     reasoning: bool
243:     can_disable_reasoning: bool | None = None
246: class ModelOptionProvider(OpenModel):
250:     slug: str
251:     name: str
252:     models: list[str] = Field(default_factory=list)
260:     authenticated: bool | None = None
264:     capabilities: dict[str, ModelCapabilities] | None = None
265:     pricing: dict[str, ModelPricing] | None = None
273: class ModelOptionsResult(Result):
274:     providers: list[ModelOptionProvider]
275:     model: str = ""
276:     provider: str = ""
279: method("model.options", params=ModelOptionsParams, result=ModelOptionsResult,
280:        doc="Provider/model inventory for the picker, layered over the session's live provider when given.")
```

| 事实 | 行 |
|---|---|
| 入参 `profile`（继承）/`session_id`/`explicit_only`/`include_unconfigured`/`refresh` | `config_free_tier_control.py:216-220` |
| `providers[].models`（模型 id 列表） | `config_free_tier_control.py:252` |
| `providers[].capabilities`（`dict[model_id → {fast, reasoning}]`）→ `Flash` 徽标来源 | `config_free_tier_control.py:264` + `:238-243` |
| `providers[].authenticated` | `config_free_tier_control.py:260` |
| `providers[].pricing` | `config_free_tier_control.py:265` + `:225-235` |
| 回包顶层 `model` / `provider`（**对齐唯一结构化来源**） | `config_free_tier_control.py:275-276` |
| doc：“layered over the session's live provider when given” | `config_free_tier_control.py:280` |
| `ModelOptionsParams(ProfileParams)` → 声明 `profile`，**必须带 `profile`**（REQ-019） | `config_free_tier_control.py:216` |

`normalizeModelCatalog` 归一化目标与 `providers[].slug/name`、`capabilities[id].fast`、顶层 `model/provider` 对应（`apps/web/src/chat/composer/modelCatalog.ts`）。

---

## 4. WS 豁免清单：参数类声明 `profile` 与否（REQ-017 判据）

`Params` 基类显式拒绝未知键：

```python
32: class Params(BaseModel):
33:     """... Unknown keys are rejected."""
35:     model_config = ConfigDict(extra="forbid", populate_by_name=True)
```

来源：`contracts/base.py:32-35`（另见模块 docstring `base.py:16`：“an unknown key is a client bug and answers ``4000``”）。
`ProfileParams` 声明了 `profile`：`contracts/common.py:228-231`。

### 4.1 豁免（参数类**未声明** `profile`；注入会触发 4000）

| # | 方法 | 参数类 | 参数类行 | 方法注册行 |
|---|---|---|---|---|
| 1 | `ping` | `PingParams(Params)` | `liveness.py:9` | `liveness.py:17` |
| 2 | `gateway.capabilities` | `PingParams(Params)` | `liveness.py:9` | `liveness.py:25` |
| 3 | `client.capabilities` | `ClientCapabilitiesParams(Params)` | `liveness.py:29` | `liveness.py:41` |
| 4 | `complete.slash` | `CompleteSlashParams(Params)` | `profiles_vault_complete_foreign_subagents.py:50` | `:64` |
| 5 | `reload.env` | `ReloadEnvParams(Params)` | `tools_mcp_plugins.py:101` | `:109` |
| 6 | `reload.mcp` | `ReloadMcpParams(Params)` | `tools_mcp_plugins.py:113` | `:137` |
| 7 | `plugins.list` | `PluginsListParams(Params)` | `tools_mcp_plugins.py:564` | `:578` |
| 8 | `learning.frames` | `LearningFramesParams(Params)` | `tools_mcp_plugins.py:240` | `:303` |
| 9 | `learning.detail` | `LearningNodeParams(Params)` | `tools_mcp_plugins.py:307` | `:329` |
| 10 | `learning.delete` | `LearningNodeParams(Params)` | `tools_mcp_plugins.py:307` | `:332` |
| 11 | `paste.collapse` | `PasteCollapseParams(Params)` | `profiles_vault_complete_foreign_subagents.py:68` | `:78` |
| 12 | `model.save_key` | `ModelSaveKeyParams(Params)` | `profiles_vault_complete_foreign_subagents.py:82` | `:92` |
| 13 | `model.disconnect` | `ModelDisconnectParams(Params)` | `profiles_vault_complete_foreign_subagents.py:96` | `:107` |
| 14 | `diagnostics.share_nous` | `DiagnosticsShareNousParams(Params)` | `config_free_tier_control.py:156` | `:172` |
| 15 | `image.generate` | `ImageGenerateParams(Params)` | `config_free_tier_control.py:286` | `:304` |
| 16 | `tools.list` | `_SessionScoped(Params)` | `tools_mcp_plugins.py:19-23` | `:44` |
| 17 | `toolsets.list` | `_SessionScoped(Params)` | `tools_mcp_plugins.py:19-23` | `:47` |
| 18 | `tools.show` | `_SessionScoped(Params)` | `tools_mcp_plugins.py:19-23` | `:66` |
| 19 | `skills.reload` | `SkillsReloadParams(Params)`（仅 `session_id`） | `tools_mcp_plugins.py:207` | `:233` |
| 20 | `learning.edit` | `LearningEditParams(LearningNodeParams)` | `tools_mcp_plugins.py:311` | `:335` |
| 21 | `onboarding.ensure_setup_profile` | `Params`（空） | —（直接使用基类 `Params`） | `profiles_vault_complete_foreign_subagents.py:392` |
| 22 | `onboarding.reset_setup_profile` | `Params`（空） | —（直接使用基类 `Params`） | `profiles_vault_complete_foreign_subagents.py:402` |
| 23 | `browser.controller.register` | `BrowserControllerRegisterParams(BrowserControllerParams)` | `groups_bot_relay.py:583` | `:606` |
| 24 | `browser.controller.result` | `BrowserControllerResultParams(BrowserControllerParams)` | `groups_bot_relay.py:611` | `:622` |
| 25 | `browser.controller.heartbeat` | `BrowserControllerParams(Params)`（`session_id: str` 必填） | `groups_bot_relay.py:577` | `:627` |
| 26 | `browser.controller.detach` | `BrowserControllerParams(Params)`（`session_id: str` 必填） | `groups_bot_relay.py:577` | `:635` |

> 计数：方法 **26 条**（其中 `ping`/`gateway.capabilities` 共用类，`learning.detail`/`delete`/`edit` 继承 `LearningNodeParams`，`tools.*` 三条共用类，`browser.controller.heartbeat`/`detach` 共用类）。
> **变更记录（2026-09-30）**：MethodSweep 机械核验发现原 18 条为真子集，补齐 #19–#26（`skills.reload` / `learning.edit` / `onboarding.ensure_setup_profile` / `onboarding.reset_setup_profile` / `browser.controller.{register,result,heartbeat,detach}`）；**无「多出」项**（无方法被错误豁免）。详见 §4.3。

### 4.2 须注入（参数类**声明了** `profile`；非 super_admin 缺 profile 时必须注入，否则落启动 profile → 跨租户）

| # | 方法 | 参数类 | 参数类行 | 方法注册行 |
|---|---|---|---|---|
| 1 | `commands.catalog` | `CommandsCatalogParams(Params)`（声明 `profile`） | `tools_commands.py:190` | `:227` |
| 2 | `config.show` | `ConfigShowParams(Params)`（声明 `profile`） | `tools_commands.py:325` | `:340` |
| 3 | `cron.manage` | `CronManageParams(Params)`（声明 `profile`） | `tools_commands.py:423` | `:505` |
| 4 | `shell.exec` | `ShellExecParams(Params)`（声明 `profile`） | `tools_commands.py:155` | `:166` |
| 5 | `cli.exec` | `CliExecParams(Params)`（声明 `profile`） | `tools_commands.py:170` | `:183` |
| 6 | `process.kill` | `ProcessKillParams(Params)`（声明 `profile`） | `tools_commands.py:122` | `:148` |
| 7 | `tools.configure` | `ToolsConfigureParams(Params)`（声明 `profile`） | `tools_mcp_plugins.py:75` | `:94` |
| 8 | `browser.manage` | `BrowserManageParams(Params)`（声明 `profile`） | `tools_commands.py:518` | `:531` |
| 9 | `agents.list` | `AgentsListParams(Params)`（声明 `profile`） | `tools_commands.py:67` | `:82` |
| 10 | `insights.get` | `InsightsGetParams(Params)`（声明 `profile`） | `tools_commands.py:310` | `:321` |
| 11 | `session.set_hidden` | `SessionSetHiddenParams(Params)`（声明 `profile`） | `sessions.py:308-312` | `:321` |
| 12 | `complete.path` | `CompletePathParams(ProfileParams)` | `profiles_vault_complete_foreign_subagents.py:37` | `:46` |
| 13 | `llm.oneshot` | `LlmOneshotParams(ProfileParams)` | `sessions.py:715` | `:732` |

> 判据**唯一**：参数类是否声明 `profile` 字段。**不得**以「是否直继 `Params`」判断——`CommandsCatalogParams(Params)`/`ConfigShowParams(Params)` 直继 `Params` 却声明了 `profile`；`_SessionScoped(Params)` 直继 `Params` 却无 `profile`。
> 其余未列入本表的方法，凡参数类（含继承）声明了 `profile` 或未知方法 → 一律按 4.2 处理（注入或 403）；仅 §4.1 豁免。

### 4.3 MethodSweep 机械核验结果（2026-09-30）

**目的**：机械断言「WS 豁免集合 == 参数类 schema 未声明 `profile` 字段的方法集合」（R14 / Q-010），闭合「人工枚举漏方法」风险。

**方法**：以 `tui_gateway.contracts` 包为数据源（`__init__.py` 导入全部 topic 模块触发 `method(...)` 注册），遍历 `registry.METHODS`，对每个方法的 `contract.params.model_fields` 判定是否含 `profile`（pydantic v2 的 `model_fields` 含继承字段，故 `ProfileParams` 子类正确计入「声明了」）。

以该包 venv 的解释器（含 pydantic 2.13）运行临时脚本：

```python
import sys
sys.path.insert(0, "/vol1/@apphome/trim.openclaw/data/home/hermes-desktop/home/hermes-agent")
import tui_gateway.contracts  # 触发全部 method(...) 注册
from tui_gateway.contracts import METHODS
no_profile = sorted(n for n in METHODS if "profile" not in METHODS[n].params.model_fields)
print(len(METHODS), len(no_profile), no_profile)
```

**结果**：

| 指标 | 值 |
|---|---|
| 注册方法总数 | **237** |
| 参数类**无** `profile` 字段（= 理论豁免集合） | **26** |
| 参数类**声明** `profile`（含继承） | 211 |
| 与 §4.1 清单对照 | 完全一致 |

- **多出**（规格豁免但契约声明 `profile` → 危险方向）：**0 条**。
- **漏掉**（契约无 `profile` 但规格原未豁免 → 会被错误注入 4000）：**8 条**，已补齐：`skills.reload`、`learning.edit`、`onboarding.ensure_setup_profile`、`onboarding.reset_setup_profile`、`browser.controller.register`、`browser.controller.heartbeat`、`browser.controller.detach`、`browser.controller.result`。
- **结论**：豁免集合已与契约机械对齐（26 条）；R14 / Q-010 **已闭合（机械核验）**。实现侧 `apps/server/src/hermes/frameGuard.ts#PROFILE_AGNOSTIC_METHODS` 与 `frameGuard.test.ts` 的名单断言同步为 26 条。

> 复核命令（只读，不依赖本仓库）：
> `grep -n "method(\"skills.reload\"\|method(\"learning.edit\"\|method(\"onboarding.ensure_setup_profile\"\|method(\"onboarding.reset_setup_profile\"\|method(\"browser.controller" "$SRC/contracts/"*.py`

---

## 5. 关键 API 结构

### 5.1 `message.complete` 事件（回合结束触发器）

来源：`contracts/events.py:183-205`

```python
183: class MessageCompletePayload(Payload):
     ...
190:     status: TurnStatus | None = None
     ...
205: event("message.complete", MessageCompletePayload, doc="The turn ended: final text, usage and outcome.")
```

`TurnStatus`：`contracts/events.py:137`（含 `complete` / `error` / `interrupted`）。
用于触发 `reconcileModel()`（REQ-010a）。

### 5.2 `session.status` 回包**仅** `output: str`；不存在 `session.info` RPC

来源：`contracts/sessions.py:431-440`

```python
431: class SessionStatusParams(SessionParams):
432:     pass
435: class SessionStatusResult(Result):
436:     output: str
439: method("session.status", params=SessionStatusParams, result=SessionStatusResult,
440:        doc="Rendered /status text for the session.")
```

| 事实 | 依据 |
|---|---|
| `session.status` 回包仅 `{output: str}`（渲染文本），**不可**用于模型对齐 | `sessions.py:435-440` |
| **方法注册表无 `session.info`**（`grep -rn 'method("session.info"'` 零命中） | — |
| `session.info` 仅作为**事件**存在（live snapshot），非可调 RPC | `contracts/events.py:366-367`；`contracts/common.py:64`（`SessionLiveInfo` doc） |
| 对齐唯一结构化来源 = `model.options` 回包 `model`/`provider` | §3（`config_free_tier_control.py:275-276/280`） |

> 结论：REQ-010a 的“契约中不存在 `session.info`”指**不存在可调用的 `session.info` RPC**；`session.info` 事件与 `session.status` 的 `output` 均不可作模型对齐。实现须用 `model.options{profile, session_id}`。

### 5.3 会话身份：stored / runtime（REQ-006）

| RPC/事件 | 身份键 | 依据 |
|---|---|---|
| `session.create` 回包 | `session_id`(runtime) + `stored_session_id`(stored) | `sessions.py:139-140` |
| `session.resume` 入参 | **stored id**（doc 明写）；回包 `session_id` = runtime | `sessions.py:174-175`（`SessionResumeParams` doc） |
| `session.workspace.move` | stored id，字段名 `session_key` | `contracts/sessions.py:325-336`（`SessionWorkspaceMoveParams(ProfileParams)`；字段名 `session_key` 见 `sessions.py:326`） |
| `session.set_hidden` | `profile` 直接声明 → 须注入 | `sessions.py:308-312` |

### 5.4 `profiles.list` 不按调用者过滤（REQ-015 前置）

来源：`methods_profiles.py:266-285`（**非** `contracts/`，为 handler 实现）

```python
266: @_profile_handler("profiles.list", 5061)
267: def _(rid, params: dict) -> dict:
268:     """List Hermes profiles. ``include_sessions`` (default true) ..."""
270:     from hermes_cli.profiles import list_profiles
271:     include_sessions = is_truthy_value(params.get("include_sessions", True))
272:     out = []
274:     for p in list_profiles(lazy_skill_count=True):
275:         row = {"name": ..., "path": ..., "model": ..., ...}
285:     return _ok(rid, {"profiles": out, "bot_mode_protocol": True})
```

| 事实 | 依据 |
|---|---|
| 遍历 `list_profiles(...)` **全量**，无调用者白名单过滤 → 全量返回 `name/path/model/description` | `methods_profiles.py:274-285` |
| 响应侧需 BFF 按 `user_profiles` 白名单过滤（REQ-015） | 本 Spec；`ProfileParams` 声明 `profile`（`contracts/profiles_vault_complete_foreign_subagents.py:168` `ProfilesListParams(ProfileParams)`），但注入后仍返回全量 → 必须响应过滤 |

---

## 6. 无法用 profile 守卫的方法集合（残余 R24）

`_SessionScoped` 无 `profile` 字段，且 handler 在缺 `session_id` 时回退**启动 profile** 的配置：

```python
19: class _SessionScoped(Params):
20:     """Handlers that look a live session up with ``_sessions.get(params.get("session_id"))``: an
21:     absent / unknown id falls back to the launch profile's config, so it is never required."""
22:
23:     session_id: str | None = None
```

来源：`contracts/tools_mcp_plugins.py:19-23`

| 方法 | 参数类 | 风险 |
|---|---|---|
| `tools.list`（`tools_mcp_plugins.py:44`） | `_SessionScoped`（无 `profile`） | schema 无 `profile` → **注入即 4000**；无法 profile 守卫 |
| `toolsets.list`（`:47`） | `_SessionScoped`（无 `profile`） | 同上 |
| `tools.show`（`:66`） | `_SessionScoped`（无 `profile`） | 同上 |

**R24（已闭合，TASK-036）**：上述 handler 缺 `session_id` 时回退**启动 profile** 配置（源码注释明写 `tools_mcp_plugins.py:20-21`）→ 跨租户读取工具/Toolsets 目录。因参数类无 `profile` 字段，**无法用 profile 守卫闭合**；改为 **session 归属校验**：BFF WS 代理为每条连接维护 `sessionOwners`（runtime/stored session_id → profile，源自 `session.create`/`session.resume`/`session.activate` 回包；`session.list` 行含 `profile` 时也登记；上限 512 / TTL 10 min）。非 `super_admin` 的 `_SessionScoped` 请求：缺 `session_id` → fail-closed 拒绝（`SESSION_SCOPED_NO_PROFILE_METHODS`，判定早于豁免清单）；带 `session_id` → 归属命中且 `userCanAccessProfile` 通过才放行，未知/他人会话一律 403 不转发。见 `architecture.md §7.2`。

---

## 7. 可复核命令

```bash
SRC=/vol1/@apphome/trim.openclaw/data/home/hermes-desktop/home/hermes-agent/tui_gateway
grep -n "class SessionCreateParams" "$SRC/contracts/sessions.py"          # 118
grep -n "class ConfigSetParams" "$SRC/contracts/config_free_tier_control.py"  # 74
grep -n "class ModelOptionsResult" "$SRC/contracts/config_free_tier_control.py" # 273
grep -n "message.complete" "$SRC/contracts/events.py"                     # 205
grep -n "class SessionStatusResult" "$SRC/contracts/sessions.py"          # 435
grep -n "extra=\"forbid\"" "$SRC/contracts/base.py"                       # 35
grep -n "class _SessionScoped" "$SRC/contracts/tools_mcp_plugins.py"      # 19
grep -rn 'method("session.info"' "$SRC/contracts" --include=*.py          # 零命中
```
