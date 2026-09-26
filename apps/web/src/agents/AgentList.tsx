import { agentInitial, type AgentSummary } from "./agents";

export interface AgentListProps {
  agents: AgentSummary[];
  activeName: string | null;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelect: (name: string) => void;
  onCreate?: () => void;
  onImport?: () => void;
  /** name → 头像 data URL（可选，缺省用首字母占位）。 */
  avatars?: Record<string, string>;
}

/** 智能体列表（上下文侧栏列表）：头像 · 名称 · 模型 · 状态灯。 */
export default function AgentList({
  agents,
  activeName,
  filter,
  onFilterChange,
  onSelect,
  onCreate,
  onImport,
  avatars,
}: AgentListProps) {
  return (
    <div className="agent-list">
      <div className="agent-list-head">
        <input
          className="agent-search"
          type="search"
          aria-label="搜索智能体"
          placeholder="搜索智能体"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
        {onCreate ? (
          <button type="button" className="primary" onClick={onCreate}>
            新建
          </button>
        ) : null}
        {onImport ? (
          <button type="button" className="ghost" onClick={onImport}>
            导入
          </button>
        ) : null}
      </div>

      {agents.length === 0 ? (
        <p className="empty">暂无智能体</p>
      ) : (
        <ul className="agent-items">
          {agents.map((agent) => {
            const avatar = avatars?.[agent.name];
            const active = agent.name === activeName;
            return (
              <li className="agent-row" key={agent.name}>
                <button
                  type="button"
                  className="agent-item"
                  data-active={active}
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(agent.name)}
                >
                  {avatar ? (
                    <img className="agent-avatar-img" src={avatar} alt="" />
                  ) : (
                    <span className="agent-avatar" aria-hidden="true">
                      {agentInitial(agent.displayName)}
                    </span>
                  )}
                  <span className="agent-meta">
                    <span className="agent-name">{agent.displayName}</span>
                    <span className="agent-model muted">{agent.model || "—"}</span>
                  </span>
                  {agent.isDefault ? <span className="agent-badge">默认</span> : null}
                  <i
                    className="dot"
                    data-on={agent.status === "active"}
                    title={agent.status === "active" ? "运行中" : "空闲"}
                    aria-label={agent.status === "active" ? "运行中" : "空闲"}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
