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
| 无 `profile` 字段且缺 `session_id` 回退启动 profile 的方法能否用 profile 守卫 | **不能**（schema 无 `profile`，注入即 4000）；R24 以 **session 归属校验**闭合 7 条 (A) 类（§6.2/§6.3） | `contracts/tools_mcp_plugins.py:19-23`；`server.py:568-595` |
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

## 6. 无法用 profile 守卫、须 session 归属校验的方法集合（R24，已闭合）

### 6.1 机械筛选：豁免 ∩ 参数类声明 `session_id`

以 `tui_gateway.contracts.METHODS` 为数据源，取 `PROFILE_AGNOSTIC_METHODS`（26 条）中参数类 `model_fields`（含继承）声明 `session_id` 者，共 **12 条**：

```python
import tui_gateway.contracts
from tui_gateway.contracts import METHODS
for n, c in sorted(METHODS.items()):
    f = c.params.model_fields
    if "profile" not in f and "session_id" in f:
        print(n, c.params.__name__, f["session_id"].is_required(), f["session_id"].default)
```

### 6.2 逐条读 handler 的归类审计（2026-09-30）

判据：**(A)** 缺/未知 `session_id` → 回退**启动 profile / launch env**（危险，须归属校验）；**(B)** 缺 `session_id` → handler 自行 fail-closed；**(C)** 与 session 无关或有意全局（`session_id` 不影响 home/profile 解析）。

| 方法 | 参数类 | `session_id` | 归类 | 证据（`文件:行`） |
|---|---|---|---|---|
| `tools.list` | `_SessionScoped(Params)` | 可选（`None`） | **A** | `contracts/tools_mcp_plugins.py:19-23,44`（docstring: absent/unknown id → launch profile） |
| `toolsets.list` | `_SessionScoped(Params)` | 可选 | **A** | `contracts/tools_mcp_plugins.py:19-23,47` |
| `tools.show` | `_SessionScoped(Params)` | 可选 | **A** | `contracts/tools_mcp_plugins.py:19-23,66` |
| `skills.reload` | `SkillsReloadParams(Params)` | 可选 | **A** | handler `methods_tools.py:1291-1304`；helper docstring `methods_tools.py:591-601`（unscoped → launch profile #110695）；契约 `tools_mcp_plugins.py:207,233` |
| `complete.slash` | `CompleteSlashParams(Params)` | 可选 | **A** | handler `methods_complete.py:276-289`（`_session_home_scope(_sessions.get(...))`）；helper `methods_tools.py:591-601`；契约 `profiles_vault_complete_foreign_subagents.py:50,64` |
| `model.save_key` | `ModelSaveKeyParams(Params)` | 可选 | **A** | `@_profile_scoped` `server.py:568-595`（取不到会话 → `profile_home=None` → 启动 profile scope，**写凭证**）；handler `methods_complete.py:347-384`；契约 `profiles_vault_complete_foreign_subagents.py:82,92` |
| `model.disconnect` | `ModelDisconnectParams(Params)` | 可选 | **A** | 同 `server.py:568-595`（**清凭证**）；handler `methods_complete.py:387-403`；契约 `profiles_vault_complete_foreign_subagents.py:96,107` |
| `browser.controller.register` | `BrowserControllerRegisterParams(BrowserControllerParams)` | 必填 | **B** | `methods_browser_control.py:93-126`（`_session_transport_contains(None,…)===false` → 403）；`session_transports.py:20-25`；handler `:149-182` |
| `browser.controller.result` | `BrowserControllerResultParams(...)` | 必填 | **B** | 同上 gate；handler `:185-195` |
| `browser.controller.heartbeat` | `BrowserControllerParams(Params)` | 必填 | **B** | 同上 gate；handler `:198-205` |
| `browser.controller.detach` | `BrowserControllerParams(Params)` | 必填 | **B** | 同上 gate；handler `:208-212` |
| `reload.mcp` | `ReloadMcpParams(Params)` | 可选 | **C** | `methods_tools.py:332-408`：`_do_full_reload` 显式绑定 `{"profile_home": None}` 后遍历**全部**已服务 home 重建（`:370-390`）；`session_id` 仅作 compute-host 路由（`:343-349`）。有意全局操作（契约 doc「for every live session」，`tools_mcp_plugins.py:113,137`），其全局副作用不在归属校验可闭合范围（另记） |

### 6.3 闭合（(A) 类 7 条）

`_SessionScoped` / 上述 (A) 类方法无 `profile` 字段，且 handler 在缺/未知 `session_id` 时回退**启动 profile / launch env**：

```python
19: class _SessionScoped(Params):
20:     """Handlers that look a live session up with ``_sessions.get(params.get("session_id"))``: an
21:     absent / unknown id falls back to the launch profile's config, so it is never required."""
22:
23:     session_id: str | None = None
```

来源：`contracts/tools_mcp_plugins.py:19-23`

**R24（已闭合，TASK-036）**：因参数类无 `profile` 字段，**无法用 profile 守卫闭合**；改为 **session 归属校验**：BFF WS 代理为每条连接维护 `sessionOwners`（runtime/stored session_id → profile，源自 `session.create`/`session.resume`/`session.activate` 回包；`session.list` 行含 `profile` 时也登记；上限 512 / TTL 10 min）。非 `super_admin` 的 **7 条 (A) 类**请求（`tools.list` / `toolsets.list` / `tools.show` / `skills.reload` / `complete.slash` / `model.save_key` / `model.disconnect`）：缺 `session_id` → fail-closed 拒绝（`SESSION_SCOPED_NO_PROFILE_METHODS`，判定早于豁免清单）；带 `session_id` → 归属命中且 `userCanAccessProfile` 通过才放行，未知/他人会话一律 403 不转发。见 `architecture.md §7.2`。

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

---

## 8. 真机实测（2026-09-30，网关版本 `version:"unknown"` / `release_date:"2026.9.24"`）

网关进程：`hermes serve --host 127.0.0.1 --port 19119 --skip-build`（PID 2513791）。**注意**：`apps/server/src/config.ts` 默认 `HERMES_BASE_URL=http://127.0.0.1:9119`，但本机 9119 实际是 Vite dev server（返回 `24H Web` SPA），Hermes 在 **19119**。

探测命令与原始输出：

```bash
curl -sS -m 3 http://127.0.0.1:19119/api/status
# {"version":"unknown","release_date":"2026.9.24","config_version":46,...,"gateway_running":false,...}
curl -sS -m 3 http://127.0.0.1:19119/
# <script>window.__HERMES_SESSION_TOKEN__="vsD...";window.__HERMES_AUTH_REQUIRED__=false;</script>
```

WS 连接：`ws://127.0.0.1:19119/api/ws?token=<token>`，帧 `{"jsonrpc":"2.0","id":n,"method":...,"params":{...}}`（与 `apps/web/src/api/ws.ts` 一致）。

### 8.1 `model.options{profile:"default"}` — 结构对齐（**无结构不一致**）

回包顶层键：`providers`、`model`、`provider`。`providers[]` 逐字段：

| 字段 | 类型 | 观测值（示例） |
|---|---|---|
| `slug` | string | `"moa"` / `"deepseek"` / `"custom:api.apikey.fun"` |
| `name` | string | `"Mixture of Agents"` / `"DeepSeek"` / `"api.apikey.fun"` |
| `models` | `string[]` | `["deepseek-flash","deepseek-v4-pro"]`（**字符串数组**） |
| `is_current` / `is_user_defined` | bool | `true`/`false` |
| `total_models` / `source` | number / string | `4` / `"built-in"`\|`"virtual"`\|`"user-config"` |
| `authenticated` | bool | `true` |
| `capabilities` | `{ [model_id]: {fast:bool, reasoning:bool} }` | `{"deepseek-v4.1-flash":{"fast":false,"reasoning":true}}` |
| `featured_models` | array | `[]` |
| `auth_type` / `warning` / `api_url` / `native_catalog_empty` / `aliases` | 可选 | 视 provider 出现 |
| `pricing` | — | **本 build 未出现**（契约声明 `dict[str, ModelPricing] | None`，但此端点未回传） |

顶层 `model:"deepseek-v4.1-flash"`、`provider:"custom:api.apikey.fun"`。

**与 `apps/web/src/chat/composer/modelCatalog.ts#normalizeModelCatalog` 的假设对照**：`providerName`=slug、`models` 为 string 数组、`capabilities[id].fast/reasoning`、`providers[].authenticated`、顶层 `model/provider` **全部匹配**（名称与类型一致）。**不一致项：无结构性不一致**。唯二差异均为数据层：① `pricing` 本 build 未回传（实现不依赖）；② `capabilities.fast` 全为 `false`，故无 `Flash` 徽标可渲染（数据，非结构）。

### 8.2 `config.set` 的 `deferred` / `confirm_required`

- **idle**：`config.set{key:"model",value:"deepseek-v4-pro",session_id,scope:"session"}` →
  `{"key":"model","value":"deepseek-v4-pro","warning":"","confirm_required":false,"confirm_message":"","scope":"session"}` —— **无 `deferred` 字段**。
- **回合运行中**：先 `prompt.submit`（长任务）再切模型，连续 4 次均回
  `{"key":"model","value":...,"warning":"","confirm_required":false,"confirm_message":"","scope":"session","deferred":true}` —— 确认 **`deferred:true`**。
- `warning` 非空示例：切到 `deepseek-v4.1-flash` 时回 `"Note: ... was not found in this custom endpoint's model listing ..."`。
- `confirm_required` 对 `deepseek-v4-pro` / `deepseek-flash` 均为 `false` → **本环境未观测到 `confirm_required:true`**（未能定位昂贵模型）；REQ-011 昂贵模型路径**未验证**。

### 8.3 `yolo` 取值（**已修复**）

`config.set{key:"yolo",value:<v>,session_id,scope:"session"}`（会话初始 yolo=off）：

| 入参 value | 回包 `value` | 回包 `scope` | 说明 |
|---|---|---|---|
| `"on"` | `"1"` | `"session"` | 开启（自动批准） |
| `"off"` | `"0"` | `"session"` | 关闭（默认审批） |
| `"true"` | `"1"` | `"session"` | 开启 |
| `"default"` | **`"1"`** | `"session"` | **非预期/禁用**：`"default"` 不在 `_BOOL_WORDS`，走 `not is_session_yolo_enabled()` **翻转**（会话初始 off → 变 on 开启） |

依据：`server.py:1772-1774` `_BOOL_WORDS = {"1","on","true","yes" → True; "0","off","false","no" → False}`，**不含 `"default"`**；`methods_config_set.py:278` 的 fallback 是 `_BOOL_WORDS.get(raw, not is_session_yolo_enabled(skey))`（**翻转**，非固定 off）。故 `"default"` 是被禁止的上送值。

**已修复（2026-09-30）**：`apps/web/src/chat/composer/PermissionPicker.tsx` 的 `PERMISSION_OPTIONS` 改为 `off`（默认审批）/`on`（自动批准），`controlsReducer.ts` 的 `DEFAULT_YOLO="off"`，`useSessionControls.ts` 的 `selectYolo(mode)` 原样上送 `value: mode`（无二次映射）。原实现用 `"default"` 表示「默认审批」并原样上送 → 网关**打开** yolo（自动批准），语义相反；该缺陷已消除。测试断言：选「默认」→ `config.set.value==="off"`；选「自动批准」→ `config.set.value==="on"`；且断言不产生 `"default"`（`PermissionPicker.test.tsx` / `useSessionControls.test.ts` / `controlsReducer.test.ts`）。

### 8.4 `image.attach_bytes`（1x1 PNG）

`{"attached":true,"path":".../images/upload_20260930_093746_1.png","count":1,"remainder":"","text":"[User attached image: ...]","bytes":70,"name":"...","width":1,"height":1,"token_estimate":85}`（成功）。

### 8.5 magic bytes 实证（R10）— **订正：R10 已由 REQ-023 在 BFF 闭合**

- `pdf.attach{content_base64:<非 PDF base64>, filename:"fake.pdf", session_id}` →
  `{"error":{"code":5028,"message":"pdftoppm not installed (poppler-utils package required)"}}`
  **并非预期 4017**。原因：`methods_prompt.py:797-798` 在执行 `_pdf_attach_source`（其 `:1106-1107` 才做 `%PDF-` 校验）**之前**先检查 `shutil.which("pdftoppm")`；本机无 poppler-utils → 一律 5028。带 `%PDF-` 头的假 PDF 同样 5028。→ **R10 的 PDF 4017 在本环境不可达、未验证**。
- `image.attach_bytes{content_base64:<41 字节非图片文本>, filename:"fake.png", session_id}` →
  `{"attached":true,"path":".../upload_20260930_094016_1.png","bytes":41,...}`（**被接受**，无 width/height）。原因：`prompt_attachments.py:64-71` `_sniff_image_ext` 仅**推断扩展名**（filename 后缀优先；未知魔数默认 `.png`），`methods_prompt.py:775-776` 只判扩展名是否在允许集合——**不做拒绝**。→ 「magic bytes 校验」实为**扩展名嗅探，非安全拒绝**；R10 的「服务端校验」表述**过强**。

**R10 历史结论（2026-09-30）＝Hermes 侧未闭合**（保留实测证据）：客户端 `File.type` 仅作 UX 预筛；服务端（Hermes）**只做扩展名嗅探**（`_sniff_image_ext`），**并非内容类型拒绝**（41 字节非图片文本经 `image.attach_bytes` 被接受）；PDF 的 `%PDF-` 校验存在但被 `pdftoppm` 依赖遮蔽（缺 poppler-utils 先回 5028，分支不可达）。原「R10 已闭合（magic bytes 在 Hermes 校验）」表述**作废**。

**R10 处置落地（REQ-023 / TASK-037，2026-09-30）＝已在 BFF 闭合**：不再依赖 Hermes 的内容类型判定，改由 **BFF WS 代理**在通过租户守卫后、转发前对 `image.attach_bytes` / `pdf.attach` 的 `content_base64`（回退 `data`）做**前缀 magic bytes** 校验：

- **权威扩展名集合（Hermes 允许）**：`hermes_cli/cli_terminal_input.py:31-34` `_IMAGE_EXTENSIONS = {.png, .jpg, .jpeg, .gif, .webp, .bmp, .tiff, .tif, .svg, .ico}`；经 `prompt_attachments.py:74-79` `_allowed_image_extensions` 消费，校验点 `methods_prompt.py:775-777`（`ext not in _allowed_image_extensions()` → 4016）。Hermes `_sniff_image_ext`（`:64-71`）**优先 filename 后缀**、仅后缀缺失时用魔数，**只推断不拒绝**。
- **权威魔数表照抄 Hermes + 补齐**：`prompt_attachments.py:20-23` `_IMAGE_MAGIC = (PNG 89 50 4E 47 0D 0A 1A 0A, JPEG FF D8 FF, GIF87a/GIF89a「GIF8」, BMP 42 4D)`；WebP 由 `:69-70` 的 `RIFF`（0-3）+ `WEBP`（8-11）判定；PDF 魔数 `%PDF-`（`methods_prompt.py:1106`）。Hermes 允许但无魔数条目的格式由 BFF 补齐：**TIFF**（LE `49 49 2A 00` / BE `4D 4D 00 2A`）、**ICO**（`00 00 01 00`）、**CUR**（`00 00 02 00`）、**SVG**（文本前缀：去 UTF-8 BOM/前置空白后以 `<svg` 或 `<?xml` 开头，大小写不敏感）。按扩展名归并后 **BFF 接受集 == Hermes 允许集**。
- **仅前缀解码**：**先截取有界前缀切片** `raw.slice(0, ATTACHMENT_PREFIX_SCAN_CHARS = 48×8 = 384)`，再剥离 `data:...;base64,` 前缀与空白、取前 **48 个 base64 字符**（≈36 字节；覆盖最长二进制魔数 WebP 12 字节，及 SVG 的 BOM 3 字节 + `<?xml` 5 字符文本判定）→ `Buffer.from(prefix,"base64")`，**禁止整帧解码**（10MB 载荷 base64 ≈13.3MB）。前缀长度由初版 24 → 48；**清洗边界由「整段」改为「384 字符切片」**（消除对整段 13MB 的两次全量扫描，见 §8.9）。
- **策略**：**能判定则判定、无法判定则拒绝**（fail-closed）。**已知差异**：除 SVG 用文本前缀判定、CUR 不在 Hermes 允许集但 BFF 宽容接受（更严的上游仍会拒绝，无 fail-open）外，**当前无「Hermes 允许且无法用前缀魔数判定」的格式**。
- **拒绝形状**：同 `id` 回 `{error:{code:400,message,data:{code:"INVALID_ATTACHMENT_TYPE"}}}`，**不转发**，并写 `audit`（action=`ws.upload.invalid_type`；不含 token/密钥/字节）。
- **范围**：仅非 `super_admin` 且 `method ∈ {image.attach_bytes, pdf.attach}`；`file.attach` **不限类型**；`path` 形态（无 base64 载荷）交由上游。
- **契约依据**：`tui_gateway/prompt_attachments.py:20-23/64-71/74-79`；`hermes_cli/cli_terminal_input.py:31-34`；`tui_gateway/methods_prompt.py:775-777/797-798/1106-1107`。

### 8.6 10MB 单帧可达性（R15，**直连网关**）

`image.attach_bytes`，`content_base64` 长度 **13,981,016** 字符（≈13.33 MiB），整帧 ≈13,981,149 字节：

```
image.attach_bytes ~10MB -> {"attached":true,"path":".../upload_20260930_093747_2.png","count":2,"text":"...","bytes":10485760,"name":"..."} elapsedMs=290
```

→ 网关**接受**该帧（290ms，无断开）。**注意**：此路径**直连 Hermes，未经过 BFF 代理**，故「经 BFF 端到端」仍未实测；BFF `maxPayload=16 MiB`（REQ-018）未在本轮触发。

### 8.7 REST 注入后上游是否按租户作用域（REQ-022）

直连 L2（`x-hermes-session-token` header），`/api/chat/workspaces`：

```bash
curl ... /api/chat/workspaces                       # 200 {"projects":[],"repos":[...],"default_cwd":"..."}
curl ... /api/chat/workspaces?profile=default        # 200 与上完全相同
curl ... /api/chat/workspaces?profile=nonexistent_xyz# 404 {"detail":"Profile 'nonexistent_xyz' does not exist."}
```

`/api/sessions` 同样：`?profile=nonexistent_xyz` → 404 同名 detail。

→ 上游**消费并校验** `profile` 查询参数（未知 profile → 404），**注入不会被静默忽略**。因本机仅 1 个 profile（`default`），带与不带内容一致，**跨租户差异无法在本环境展示**。→ REQ-022 上游作用域**已确认有效（校验观测到）**；跨 profile 隔离差异**未验证**（单 profile）。

### 8.8 清理

临时会话已 `session.delete`（`{"deleted":"20260930_094202_78ac9a"}`；另两条连接断开后自行消失）；`session.delete` 对活动会话回 `4023 cannot delete an active session`（须先断开连接）。三张临时上传图片（`upload_20260930_093746_1.png` / `_093747_2.png` / `_094016_1.png`）已从 `~/.hermes/images/` 删除。未改动网关配置。

### 8.9 BFF WS 代理：队列上限与大帧路径实测（2026-09-30，mock 上游）

运行：`npx vitest run src/hermes/proxy.largePayload.test.ts`（`apps/server`，mock 上游、BFF 真实体量）。所有数字为**当轮实测**（机器负载相关，供量级参考）：

| 用例 | 帧字节 | 触发/断言 | 累计 | 耗时 | 备注 |
|---|---|---|---|---|---|
| case1 转发 ≈13.3MB PNG attach | `13981124`B（payload `13981016`B，forwarded `13981142`B） | 在 `maxPayload = 16 MiB` 内成功转发 | — | **148.2ms** | 注入 `profile=alpha` |
| case2 超 `maxPayload` | `16781372`B | `close=1009`（message too big） | — | **25.2ms** | 上游未收到 |
| case3a 条数上限 | `131`B/帧（小帧） | **第 257 帧**（`WS_MAX_PENDING_COUNT = 256`）命中 → `1013/QUEUE_OVERFLOW` | **33667B ≈ 0.032 MiB** | **2682.8ms** | 300 帧测；字节远未满 |
| case3b 字节上限 | `16776192`B/帧（guarded `16778204`B） | **第 4 帧**命中 → `1013/QUEUE_OVERFLOW` | **67104768B ≈ 64 MiB**（= `K=4 × 16 MiB`） | **1299.9ms** | 条数上限 256 远未触发 |
| case3c 冷启动 5 小帧（回归） | `133`B/帧 | 5 帧**全部通过**、连接保持 OPEN、`received=0` | — | **504.5ms** | 修复前第 5 帧即被拒 |
| case4 13MB 非图片拒绝（REQ-023） | `13631596`B | 同 `id` `INVALID_ATTACHMENT_TYPE`，`base64Calls=1`、`maxDecodedChars=48` | — | **51.8ms** | 仅前缀解码，未整帧解码 |

**JSON.parse 次数**（`frameGuard.test.ts` spy，`guardClientFrame` 单帧）：修复前 **2**（`JSON.parse` + `classifyFrame` 二次解析），修复后 **1**，且不随载荷增大（small=1 / large 4MiB=1）。

**`readBase64Prefix` 微基准**（18,175,328 字符 base64 载荷，200 次）：修复前全量 `trim()`+`replace(/\s+/g,"")` **≈565µs/次**；修复后先 `slice(0, 384)` 有界切片 **≈0.7µs/次**（≈800×）。

**`outbound` 对称上限（本轮）**：`outbound`（上游→客户端，**仅客户端 socket 未 `OPEN` 时累积**）新增 `WS_MAX_OUTBOUND_COUNT = 256` / `WS_MAX_OUTBOUND_BYTES = K × 16 MiB = 64 MiB`，判定抽为纯函数 `shouldRejectOutbound(count, bytes)`；超限写 `audit(ws.outbound.overflow)` 并 `close(1013,"QUEUE_OVERFLOW")`，`flushOutbound()` 冲刷后清零字节计数。因该窗口为极短竞态、集成层难以稳定构造，覆盖以 `proxy.largePayload.test.ts` 的**纯函数单测**为主（常量 pinning + 条数/字节各自独立，共 4 例）。

> 结论：条数上限（256）与字节上限（64 MiB）**各自独立**且均被实测触发；`pending` / `outbound` 两方向上限对称；大帧路径的二次 `JSON.parse` 与全量扫描均已消除，**无残余偏差**。

---

## 9. 批帧守卫复核与修复（F1–F4 / F7，2026-09-30）

独立复核 + 读码确认 `guardClientFrame` 批分支存在 4 个缺陷（F1–F4）；F7 为「校验方 vs 消费方」字段优先级一致性核对。**复现**以最小脚本（`tsx`，in-memory SQLite，`admin` 分配 `alpha`(default)）逐条打印修复前实际行为：

### 9.1 F1（HIGH 安全）嵌套批帧绕过租户守卫

- **载荷**：`[[{"jsonrpc":"2.0","id":1,"method":"session.create","params":{"profile":"gamma"}}]]`（`admin` 未分配 `gamma`）。
- **修复前实际输出**：`{"action":"forward","text":"[[{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"session.create\",\"params\":{\"profile\":\"gamma\"}}]]","injected":false}` → **整帧被转发**（绕过）。
- **根因**：批分支对每个元素调 `classifyParsed`；嵌套数组元素 → `kind === "batch"` → `decideProfileGuard` 因 `kind !== "request"` 返回 `allow` → `:517` 原样转发。
- **修复**：批分支预扫描元素分类，任一为 `batch`/`invalid`/`binary` → 整批 `reject INVALID_FRAME`（`id:null`）。JSON-RPC 2.0 禁止嵌套批。
- **修复后**：`{"action":"reject","code":"INVALID_FRAME","id":null}`；更深嵌套同样拒绝；**不转发**。

### 9.2 F2（HIGH 功能）混合批帧误注入豁免方法 → 上游 4000

- **载荷**：`[{"method":"ping","params":{}},{"method":"session.list","params":{}}]`（`admin` 有 `alpha`）。
- **修复前实际输出**：`ping` 元素被注入 `"profile":"alpha"`（`{"method":"ping","params":{"profile":"alpha"}}`）→ `PingParams` `extra="forbid"` → 上游 **4000**，整批失败。
- **根因**：`:513-515` 只要 `needsInject`，就对 `elements.map(injectIntoElement)`；`injectIntoElement`（`:419-428`）只看元素本地是否已有 `profile`，不看方法是否属 `PROFILE_AGNOSTIC_METHODS`。
- **修复**：批循环按每个元素的 `decision.action` 记录**需注入的元素索引**（仅 `inject`），只对这些索引注入；`allow`（含豁免方法）元素原样保留。
- **修复后**：`ping` 元素**不含** `profile`；`session.list` 元素含 `"profile":"alpha"`；整批 `forward` 且 `injected===true`。

### 9.3 F3（安全一致性）批内非法元素未拒绝

- **载荷**：`[{"method":null}]`。
- **修复前实际输出**：`{"action":"forward","text":"[{\"method\":null}]","injected":false}` → **被转发**（顶层单帧本会 `reject INVALID_FRAME`）。
- **根因**：同 F1，`classifyParsed` → `invalid` → `decideProfileGuard` 因 `kind !== "request"` 返回 `allow`。
- **修复**：随 F1 一并处理（批内 `invalid`/`binary` → 整批 `INVALID_FRAME`）。
- **修复后**：`{"action":"reject","code":"INVALID_FRAME","id":null}`。

### 9.4 F4（fail-closed 默认）`sessionOwners` 可选导致安全控制默认放行

- **载荷/调用**：`decideProfileGuard(classifyParsed({method:"tools.list",params:{session_id:"runtime:x"}}), admin, db)`（**不传** `sessionOwners`）。
- **修复前实际输出**：`{"action":"allow"}` → 带任意 `session_id` 即放行（(A) 类方法缺/未知会话会回退启动 profile）。
- **根因**：`sessionOwners?: ReadonlyMap` 可选；未传时跳过归属校验直接 `allow`。
- **修复**：改为 fail-closed 默认——参数默认值 `EMPTY_SESSION_OWNERS`（空表），`session_id` 一律无法命中 → `deny`；JSDoc 标注「缺省即 deny」。`proxy.ts` 始终传入 per-connection 非空 `sessionOwners`（确认并保持）。同步把既有单测「不传表时 `tools.list{session_id}` → allow」改为 **deny**。
- **修复后**：`{"action":"deny"}`；7 条 (A) 类方法在缺省表下均 deny。

### 9.5 F7（校验方 vs 消费方一致性）附件载荷字段优先级

- **上游证据（`tui_gateway/methods_prompt.py`）**：
  - `image.attach_bytes` — `:763`：`raw_b64 = str(params.get("content_base64") or params.get("data") or "").strip()` → **`content_base64` 优先**、`data` 为别名。
  - `pdf.attach` — `:800`：`raw_b64 = str(params.get("content_base64") or params.get("data") or "").strip()` → 同上。
  - 契约：`contracts/prompt_voice.py:120-127`（`ImageAttachBytesParams`：`content_base64` / `data` 别名，**无 `data_url`**）/`:134-143`（`PdfAttachParams`：`path` / `content_base64` / `data`）。`data_url` 仅属 `file.attach`（`:164-170`）。
- **对齐结论**：BFF 校验方 `readAttachmentPayload` 的取值顺序 `content_base64` → `data` **与上游一致**（非 `data` 优先）；不支持 `data_url` 亦与上游一致。实现镜像 Python `or` 链（`content_base64` 为非空字符串时优先，缺失/空串才回退 `data`）。
- **修复前实际输出**（`content_base64` 为垃圾、`data` 为合法 PNG）：`{"ok":false,...}` → 读取 `content_base64`（正确），**已与上游一致**；本轮补齐「校验读取同一字段」的显式单测（正向/反向/PDF 三例）。

### 9.6 未闭合项（登记，勿扩大范围）

- **F5**：WS 重连后 per-connection `sessionOwners` 清空（新连接未持有旧会话归属）→ 旧会话的 (A) 类请求会被 fail-closed 拒绝（安全但功能有损）；后续可评估重连时重建归属。
- **F6**：`model.save_key` / `model.disconnect` 的产品语义（启动 profile 凭证写入的授权边界）待产品确认。
- **F9**：批帧逐元素 `decideProfileGuard` 的 `resolveDefaultProfile` 在超大批（数百元素）下的性能未专门优化（上限受 `maxPayload` 约束）。

