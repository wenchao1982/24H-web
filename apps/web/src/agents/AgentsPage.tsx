import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useGateway } from "../chat/GatewayProvider";
import {
  normalizeAgentDetail,
  normalizeAgentList,
  type AgentDetail as AgentDetailData,
  type AgentSummary,
} from "./agents";
import AgentList from "./AgentList";
import AgentDetail from "./AgentDetail";
import AgentCreatePanel, { type CreateProfileParams } from "./AgentCreatePanel";
import AgentEditPanel, { type ConfigureProfileParams } from "./AgentEditPanel";
import SkillsPanel from "./SkillsPanel";
import ToolsetsPanel from "./ToolsetsPanel";
import McpPanel from "./McpPanel";
import PluginsPanel from "./PluginsPanel";

interface TabDef {
  id: string;
  label: string;
}

const TABS: TabDef[] = [
  { id: "skills", label: "技能" },
  { id: "toolsets", label: "工具" },
  { id: "mcp", label: "MCP" },
  { id: "plugins", label: "插件" },
];

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
                setEditing(false);
              }}
              onCreate={() => openCreate("new")}
            />
          )}
        </aside>

        <section className="agents-main">
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
              actions={
                detail ? (
                  <>
                    <button type="button" onClick={() => setEditing(true)}>
                      编辑
                    </button>
                    <button type="button" onClick={() => openCreate("clone", detail.name)}>
                      克隆
                    </button>
                  </>
                ) : null
              }
            />
          )}

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
            {tab === "skills" ? <SkillsPanel profile={selected ?? undefined} /> : null}
            {tab === "toolsets" ? <ToolsetsPanel profile={selected ?? undefined} /> : null}
            {tab === "mcp" ? <McpPanel profile={selected ?? undefined} /> : null}
            {tab === "plugins" ? <PluginsPanel /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
