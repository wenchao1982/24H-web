import type { ReactNode } from "react";
import { agentInitial, type AgentDetail as AgentDetailData } from "./agents";

export interface AgentDetailProps {
  agent: AgentDetailData | null;
  loading?: boolean;
  error?: string | null;
  /** 头像 data URL；缺省用首字母占位。 */
  avatar?: string;
  /** 顶部操作区（克隆/编辑/导出/删除等）。 */
  actions?: ReactNode;
  /** 头像下方追加区（如上传按钮）。 */
  avatarExtra?: ReactNode;
}

/** 智能体详情：SOUL / 模型 / 技能 / MCP（只读概览）。 */
export default function AgentDetail({
  agent,
  loading = false,
  error = null,
  avatar,
  actions,
  avatarExtra,
}: AgentDetailProps) {
  if (loading) {
    return <p className="empty">加载智能体详情中…</p>;
  }
  if (!agent) {
    return <p className="empty">请选择或新建一个智能体。</p>;
  }

  return (
    <div className="agent-detail">
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <header className="agent-detail-head">
        <span className="agent-avatar-wrap">
          {avatar ? (
            <img className="agent-avatar-img large" src={avatar} alt={`${agent.displayName} 头像`} />
          ) : (
            <span className="agent-avatar large" aria-hidden="true">
              {agentInitial(agent.displayName)}
            </span>
          )}
          {avatarExtra}
        </span>
        <div className="agent-detail-title">
          <h2 className="agent-detail-name">{agent.displayName}</h2>
          {agent.description ? <p className="muted">{agent.description}</p> : null}
          {agent.provider ? <p className="muted">提供商：{agent.provider}</p> : null}
          <p className="muted">模型：{agent.model || "—"}</p>
        </div>
        {actions ? <div className="agent-actions">{actions}</div> : null}
      </header>

      <section className="agent-section">
        <h3>SOUL</h3>
        <pre className="agent-soul">{agent.soul || "（未设置）"}</pre>
      </section>

      <details className="agent-overview">
        <summary>技能与 MCP 概览</summary>

        <section className="agent-section">
          <h3>技能</h3>
          {agent.skills.length === 0 ? (
            <p className="empty">暂无技能。</p>
          ) : (
            <ul className="agent-chips">
              {agent.skills.map((skill) => (
                <li className="chip" data-off={!skill.enabled} key={skill.name}>
                  {skill.name}
                  {skill.enabled ? "" : "（禁用）"}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="agent-section">
          <h3>MCP</h3>
          {agent.mcpServers.length === 0 ? (
            <p className="empty">暂无 MCP 服务。</p>
          ) : (
            <ul className="agent-chips">
              {agent.mcpServers.map((server) => (
                <li className="chip" data-off={!server.enabled} key={server.name}>
                  {server.name}
                  {server.enabled ? "" : "（禁用）"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </details>
    </div>
  );
}
