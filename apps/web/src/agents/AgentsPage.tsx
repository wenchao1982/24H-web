import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { api } from "../api/client";
import {
  normalizeAgentDetail,
  normalizeAgentList,
  normalizeAvatar,
  validateAvatarDataUrl,
  withProfile,
  type AgentDetail as AgentDetailData,
  type AgentSummary,
} from "./agents";
import AgentList from "./AgentList";
import AgentDetail from "./AgentDetail";
import AgentCreatePanel, { type CreateProfileParams } from "./AgentCreatePanel";
import AgentEditPanel, { type ConfigureProfileParams } from "./AgentEditPanel";
import AgentImportPanel, { type ImportProfileParams } from "./AgentImportPanel";
import RuntimeList from "./RuntimeList";
import RuntimeDetail from "./RuntimeDetail";
import {
  checkRuntimeUpdate,
  getUpdatePolicies,
  installRuntime,
  listRuntimes,
  removeRuntime,
  setUpdatePolicy,
  type AgentRuntime,
  type PolicyMap,
} from "./runtimes";
import { Button, ConfirmDialog } from "../ui";
import { t, type TranslationKey } from "../i18n";
import SkillsPanel from "./SkillsPanel";
import ToolsetsPanel from "./ToolsetsPanel";
import McpPanel from "./McpPanel";
import PluginsPanel from "./PluginsPanel";
import BotScreenPanel from "./BotScreenPanel";

interface TabDef {
  id: string;
  label: string;
}

const TABS: TabDef[] = [
  { id: "soul", label: "SOUL" },
  { id: "skills", label: "技能" },
  { id: "toolsets", label: "工具" },
  { id: "mcp", label: "MCP" },
  { id: "plugins", label: "插件" },
  { id: "bot-screen", label: "Bot 屏幕" },
];

const TAB_INTRO: Record<string, TranslationKey> = {
  soul: "agents.tab.soul.intro",
  skills: "agents.tab.skills.intro",
  toolsets: "agents.tab.toolsets.intro",
  mcp: "agents.tab.mcp.intro",
  plugins: "agents.tab.plugins.intro",
  "bot-screen": "agents.tab.botScreen.intro",
};

/** 智能体页：agent 列表 + 详情 + 技能/工具/MCP/插件 子面板 + 经验→Skill（/learn）。 */
export default function AgentsPage() {
  const gateway = useGateway();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [tab, setTab] = useState<string>("skills");
  const [advanced, setAdvanced] = useState(true);
  const [learnArgs, setLearnArgs] = useState("");
  const [learnBusy, setLearnBusy] = useState(false);
  const [learnMsg, setLearnMsg] = useState<string | null>(null);

  const [create, setCreate] = useState<{ mode: "new" | "clone"; cloneFrom?: string } | null>(
    null,
  );
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [configureBusy, setConfigureBusy] = useState(false);
  const [configureError, setConfigureError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [opMessage, setOpMessage] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // 方案 C：外部 agent 分组（BFF `/api/agents`）。失败一律降级为空，不阻断 Hermes 分组。
  const [runtimes, setRuntimes] = useState<AgentRuntime[]>([]);
  const [policies, setPolicies] = useState<PolicyMap>({});
  const [selectedRuntime, setSelectedRuntime] = useState<string | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const loadRuntimes = useCallback(async () => {
    try {
      setRuntimes(await listRuntimes());
      setRuntimeError(null);
    } catch (err) {
      setRuntimes([]);
      setRuntimeError(err instanceof Error ? err.message : "外部 agent 探测失败");
    }
    try {
      setPolicies(await getUpdatePolicies());
    } catch {
      setPolicies({});
    }
  }, []);

  useEffect(() => {
    void loadRuntimes();
  }, [loadRuntimes]);

  const activeRuntime = runtimes.find((runtime) => runtime.id === selectedRuntime) ?? null;

  const withRuntimeBusy = useCallback(
    async (action: () => Promise<unknown>) => {
      setRuntimeBusy(true);
      try {
        await action();
        await loadRuntimes();
      } finally {
        setRuntimeBusy(false);
      }
    },
    [loadRuntimes],
  );

  const loadAgents = useCallback(async () => {
    setListLoading(true);
    try {
      await gateway.connect().catch(() => undefined);
      const result = await gateway.request("profiles.list", { include_sessions: false });
      setAgents(normalizeAgentList(result));
      setListError(null);
    } catch {
      setListError("无法加载智能体列表");
    } finally {
      setListLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    void (async () => {
      try {
        await gateway.connect().catch(() => undefined);
        const result = await gateway.request("profiles.describe", { name: selected });
        if (alive) {
          setDetail(normalizeAgentDetail(result));
          setDetailError(null);
        }
      } catch {
        if (alive) {
          setDetail(null);
          setDetailError("无法加载智能体详情");
        }
      } finally {
        if (alive) {
          setDetailLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [gateway, selected]);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return agents;
    }
    return agents.filter(
      (agent) =>
        agent.displayName.toLowerCase().includes(query) ||
        agent.name.toLowerCase().includes(query),
    );
  }, [agents, filter]);

  const openCreate = useCallback((mode: "new" | "clone", cloneFrom?: string) => {
    setCreate({ mode, cloneFrom });
    setCreateError(null);
  }, []);

  const closeCreate = useCallback(() => {
    setCreate(null);
    setCreateError(null);
  }, []);

  const submitCreate = useCallback(
    async (params: CreateProfileParams) => {
      setCreateBusy(true);
      setCreateError(null);
      try {
        await gateway.connect().catch(() => undefined);
        await gateway.request("profiles.create", params);
        setCreate(null);
        await loadAgents();
        setEditing(false);
        setSelected(params.name);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "创建智能体失败");
      } finally {
        setCreateBusy(false);
      }
    },
    [gateway, loadAgents],
  );

  const loadDetail = useCallback(
    async (name: string) => {
      await gateway.connect().catch(() => undefined);
      const result = await gateway.request("profiles.describe", { name });
      setDetail(normalizeAgentDetail(result));
    },
    [gateway],
  );

  const loadAvatar = useCallback(
    async (name: string) => {
      try {
        const payload = await api<unknown>(
          `/api/hermes/profiles/${encodeURIComponent(name)}/avatar`,
        );
        const url = normalizeAvatar(payload);
        if (url) {
          setAvatarUrl(url);
          return;
        }
      } catch {
        // REST 头像端点可能 404 → 回退 L1 `profiles.get_asset`。
      }
      try {
        await gateway.connect().catch(() => undefined);
        const result = await gateway.request<{ found?: boolean; data?: string }>(
          "profiles.get_asset",
          { name, asset: "avatar" },
        );
        setAvatarUrl(result?.found && typeof result.data === "string" ? result.data : null);
      } catch {
        setAvatarUrl(null);
      }
    },
    [gateway],
  );

  const uploadAvatar = useCallback(
    async (dataUrl: string) => {
      if (!selected) {
        return;
      }
      const invalid = validateAvatarDataUrl(dataUrl);
      if (invalid) {
        setAvatarError(invalid);
        return;
      }
      setAvatarError(null);
      try {
        await gateway.connect().catch(() => undefined);
        await gateway.request("profiles.set_asset", {
          name: selected,
          asset: "avatar",
          data: dataUrl,
        });
        setAvatarUrl(dataUrl);
        await loadAvatar(selected);
      } catch {
        setAvatarError("头像上传失败");
      }
    },
    [gateway, loadAvatar, selected],
  );

  useEffect(() => {
    setAvatarError(null);
    if (!selected) {
      setAvatarUrl(null);
      return;
    }
    void loadAvatar(selected);
  }, [loadAvatar, selected]);

  const submitConfigure = useCallback(
    async (params: ConfigureProfileParams) => {
      setConfigureBusy(true);
      setConfigureError(null);
      try {
        await gateway.connect().catch(() => undefined);
        const result = await gateway.request<{ confirm_required?: boolean; confirm_message?: string }>(
          "profiles.configure",
          params,
        );
        if (result?.confirm_required) {
          setConfigureError(result.confirm_message || "该模型需要确认，请改用其他模型");
          return;
        }
        setEditing(false);
        await loadDetail(params.name);
        await loadAgents();
      } catch (err) {
        setConfigureError(err instanceof Error ? err.message : "保存智能体失败");
      } finally {
        setConfigureBusy(false);
      }
    },
    [gateway, loadAgents, loadDetail],
  );

  const openImport = useCallback(() => {
    setImportOpen(true);
    setImportError(null);
    setOpMessage(null);
  }, []);

  const closeImport = useCallback(() => {
    setImportOpen(false);
    setImportError(null);
  }, []);

  const submitImport = useCallback(
    async (params: ImportProfileParams) => {
      setImportBusy(true);
      setImportError(null);
      try {
        await api(withProfile("/api/hermes/profiles/import", params.name), {
          method: "POST",
          body: JSON.stringify(params),
        });
        setImportOpen(false);
        setOpMessage(`已导入：${params.name || params.archive}`);
        await loadAgents();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "导入智能体失败");
      } finally {
        setImportBusy(false);
      }
    },
    [loadAgents],
  );

  const exportProfile = useCallback(async (name: string) => {
    setOpMessage(null);
    try {
      const result = await api<{ archive?: string }>(
        withProfile(`/api/hermes/profiles/${encodeURIComponent(name)}/export`, name),
        { method: "POST", body: JSON.stringify({}) },
      );
      setOpMessage(result?.archive ? `已导出：${result.archive}` : "已导出");
    } catch (err) {
      setOpMessage(err instanceof Error ? err.message : "导出智能体失败");
    }
  }, []);

  const deleteProfile = useCallback(
    async (name: string) => {
      setOpMessage(null);
      try {
        await api(withProfile(`/api/hermes/profiles/${encodeURIComponent(name)}`, name), {
          method: "DELETE",
        });
        setDeleteTarget(null);
        setEditing(false);
        setSelected(null);
        setDetail(null);
        await loadAgents();
      } catch (err) {
        setOpMessage(err instanceof Error ? err.message : "删除智能体失败");
      }
    },
    [loadAgents],
  );

  const bulkDelete = useCallback(
    async (names: string[]) => {
      setOpMessage(null);
      try {
        for (const name of names) {
          await api(withProfile(`/api/hermes/profiles/${encodeURIComponent(name)}`, name), {
            method: "DELETE",
          });
        }
        setDeleteTarget(null);
        setEditing(false);
        setSelected(null);
        setDetail(null);
        await loadAgents();
      } catch (err) {
        setOpMessage(err instanceof Error ? err.message : "删除智能体失败");
      }
    },
    [loadAgents],
  );

  const bulkExport = useCallback(
    async (names: string[]) => {
      for (const name of names) {
        await exportProfile(name);
      }
    },
    [exportProfile],
  );

  const runLearn = async (event: FormEvent) => {
    event.preventDefault();
    const args = learnArgs.trim();
    if (!args || learnBusy) {
      return;
    }
    setLearnBusy(true);
    setLearnMsg(null);
    try {
      await gateway.connect().catch(() => undefined);
      await gateway.request("slash.exec", { command: "/learn", args });
      setLearnMsg("已提交生成技能");
    } catch {
      setLearnMsg("生成技能失败");
    } finally {
      setLearnBusy(false);
    }
  };

  return (
    <div className="page agents-page">
      <div className="agents-layout">
        <aside className="agents-list-pane">
          {listError ? (
            <p className="err" role="alert">
              {listError}
            </p>
          ) : null}
          {listLoading ? (
            <p className="empty">加载智能体中…</p>
          ) : (
            <AgentList
              agents={visible}
              activeName={selected}
              filter={filter}
              onFilterChange={setFilter}
              onSelect={(name) => {
                setSelected(name);
                setSelectedRuntime(null);
                setEditing(false);
                setDeleteTarget(null);
                setOpMessage(null);
              }}
              onCreate={() => openCreate("new")}
              onImport={openImport}
              onClone={(name) => openCreate("clone", name)}
              onExport={(name) => void exportProfile(name)}
              onDelete={(name) => setDeleteTarget(name)}
              onBulkDelete={(names) => void bulkDelete(names)}
              onBulkExport={(names) => void bulkExport(names)}
              avatars={avatarUrl && selected ? { [selected]: avatarUrl } : undefined}
            />
          )}
          {runtimeError ? (
            <div className="runtime-error" role="alert">
              <span className="muted">{runtimeError}</span>
              <button type="button" className="ghost" onClick={() => void loadRuntimes()}>
                重试
              </button>
            </div>
          ) : null}
          <RuntimeList
            runtimes={runtimes}
            activeId={selectedRuntime}
            onSelect={(id) => {
              setSelectedRuntime(id);
              setSelected(null);
              setEditing(false);
              setDeleteTarget(null);
              setOpMessage(null);
            }}
          />
        </aside>

        <section className="agents-main">
          {activeRuntime ? (
            <RuntimeDetail
              runtime={activeRuntime}
              autoUpdate={policies[activeRuntime.id]?.autoUpdate ?? false}
              busy={runtimeBusy}
              onInstall={() => withRuntimeBusy(() => installRuntime(activeRuntime.id))}
              onCheckUpdate={() => checkRuntimeUpdate(activeRuntime.id)}
              onRemove={() => withRuntimeBusy(() => removeRuntime(activeRuntime.id))}
              onToggleAuto={(enabled) =>
                withRuntimeBusy(async () => {
                  setPolicies(await setUpdatePolicy(activeRuntime.id, enabled));
                })
              }
            />
          ) : (
          <>
          {create ? (
            <AgentCreatePanel
              mode={create.mode}
              agents={agents}
              defaultCloneFrom={create.cloneFrom}
              busy={createBusy}
              error={createError}
              onCancel={closeCreate}
              onSubmit={(params) => void submitCreate(params)}
            />
          ) : null}

          {importOpen ? (
            <AgentImportPanel
              busy={importBusy}
              error={importError}
              onCancel={closeImport}
              onSubmit={(params) => void submitImport(params)}
            />
          ) : null}

          {editing && detail ? (
            <AgentEditPanel
              agent={detail}
              busy={configureBusy}
              error={configureError}
              onCancel={() => setEditing(false)}
              onSave={(params) => void submitConfigure(params)}
            />
          ) : (
            <AgentDetail
              agent={detail}
              loading={detailLoading}
              error={detailError}
              avatar={avatarUrl ?? undefined}
              avatarExtra={
                detail ? (
                  <label className="agent-avatar-upload">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      aria-label="上传头像"
                      className="composer-file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => void uploadAvatar(String(reader.result ?? ""));
                          reader.readAsDataURL(file);
                        }
                        event.target.value = "";
                      }}
                    />
                    上传头像
                  </label>
                ) : null
              }
              actions={
                detail ? (
                  <>
                    <button type="button" onClick={() => setEditing(true)}>
                      编辑
                    </button>
                    <button type="button" onClick={() => openCreate("clone", detail.name)}>
                      克隆
                    </button>
                    <button type="button" onClick={() => void exportProfile(detail.name)}>
                      导出
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => setDeleteTarget(detail.name)}
                    >
                      删除
                    </button>
                  </>
                ) : null
              }
            />
          )}

          {avatarError ? (
            <p className="err" role="alert">
              {avatarError}
            </p>
          ) : null}
          {opMessage ? <p className="muted agent-op-message">{opMessage}</p> : null}

          <div className="agents-toolbar">
            <Button
              variant={advanced ? "primary" : "outline"}
              className="advanced-toggle"
              aria-label={t("agents.advanced")}
              aria-pressed={advanced}
              onClick={() => setAdvanced((value) => !value)}
            >
              {t("agents.advanced")}
            </Button>
          </div>
          <div className="tabs" role="tablist" aria-label="智能体功能">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className="tab-btn"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="tab-panel">
            <p className="tab-intro">{t(TAB_INTRO[tab])}</p>
            {tab === "soul" ? (
              detail ? (
                <section className="agent-section">
                  <pre className="agent-soul">{detail.soul || "（未设置）"}</pre>
                  <p className="muted tab-note">{t("agents.tab.soul.hint")}</p>
                </section>
              ) : (
                <p className="empty">{t("agents.tab.soul.empty")}</p>
              )
            ) : null}
            {tab === "skills" ? (
              <>
                <form className="card learn-action" onSubmit={runLearn}>
                  <div className="row">
                    <input
                      aria-label="学习来源"
                      placeholder="从经验/来源生成技能（/learn）"
                      value={learnArgs}
                      onChange={(event) => setLearnArgs(event.target.value)}
                    />
                    <button className="primary" type="submit" disabled={learnBusy}>
                      生成技能
                    </button>
                  </div>
                  {learnMsg ? <p className="muted">{learnMsg}</p> : null}
                </form>
                <SkillsPanel profile={selected ?? undefined} advanced={advanced} />
              </>
            ) : null}
            {tab === "toolsets" ? <ToolsetsPanel profile={selected ?? undefined} /> : null}
            {tab === "mcp" ? <McpPanel profile={selected ?? undefined} /> : null}
            {tab === "plugins" ? <PluginsPanel /> : null}
            {tab === "bot-screen" ? <BotScreenPanel /> : null}
          </div>
          </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除智能体"
        message={`确认删除智能体「${deleteTarget ?? ""}」？`}
        confirmLabel="确认删除"
        danger
        onConfirm={() => {
          if (deleteTarget) {
            void deleteProfile(deleteTarget);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
