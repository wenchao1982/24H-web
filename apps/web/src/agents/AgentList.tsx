import { useState } from "react";
import { agentInitial, type AgentSummary } from "./agents";
import { Button, ConfirmDialog } from "../ui";

export interface AgentListProps {
  agents: AgentSummary[];
  activeName: string | null;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelect: (name: string) => void;
  onCreate?: () => void;
  onImport?: () => void;
  /** 行内 hover 快捷操作（仅在对应行被 hover 时渲染）。 */
  onClone?: (name: string) => void;
  onExport?: (name: string) => void;
  onDelete?: (name: string) => void;
  /** 批量操作（仅批量模式可见；删除确认在列表内完成）。 */
  onBulkDelete?: (names: string[]) => void;
  onBulkExport?: (names: string[]) => void;
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
  onClone,
  onExport,
  onDelete,
  onBulkDelete,
  onBulkExport,
  avatars,
}: AgentListProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [batch, setBatch] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const bulkEnabled = Boolean(onBulkDelete) || Boolean(onBulkExport);
  const selected = agents.filter((agent) => checked.has(agent.name)).map((agent) => agent.name);

  const toggleBatch = () => {
    setBatch((value) => {
      if (value) {
        setChecked(new Set());
      }
      return !value;
    });
  };

  const toggleChecked = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const confirmBulkDelete = () => {
    onBulkDelete?.(selected);
    setBulkConfirm(false);
    setBatch(false);
    setChecked(new Set());
  };

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
        {bulkEnabled ? (
          <button
            type="button"
            className="ghost"
            aria-label="批量选择"
            aria-pressed={batch}
            onClick={toggleBatch}
          >
            {batch ? "退出批量" : "批量"}
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
            const showActions =
              !batch &&
              hovered === agent.name &&
              Boolean(onClone || onExport || onDelete);
            return (
              <li
                className="agent-row"
                key={agent.name}
                onMouseEnter={() => setHovered(agent.name)}
                onMouseLeave={() => setHovered((value) => (value === agent.name ? null : value))}
              >
                {batch ? (
                  <input
                    type="checkbox"
                    className="agent-row-check"
                    aria-label={`选择智能体 ${agent.name}`}
                    checked={checked.has(agent.name)}
                    onChange={() => toggleChecked(agent.name)}
                  />
                ) : null}
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
                  {agent.skillCount ? (
                    <span className="agent-skill-count muted">{agent.skillCount} 技能</span>
                  ) : null}
                  {agent.isDefault ? <span className="agent-badge">默认</span> : null}
                  <i
                    className="dot"
                    data-on={agent.status === "active"}
                    title={agent.status === "active" ? "运行中" : "空闲"}
                    aria-label={agent.status === "active" ? "运行中" : "空闲"}
                  />
                </button>
                {showActions ? (
                  <span className="agent-row-actions">
                    {onClone ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`克隆 ${agent.name}`}
                        onClick={() => onClone(agent.name)}
                      >
                        克隆
                      </Button>
                    ) : null}
                    {onExport ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`导出 ${agent.name}`}
                        onClick={() => onExport(agent.name)}
                      >
                        导出
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        size="sm"
                        variant="danger"
                        aria-label={`删除 ${agent.name}`}
                        onClick={() => onDelete(agent.name)}
                      >
                        删除
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {batch ? (
        <div className="agent-batch-bar">
          <Button
            size="sm"
            variant="danger"
            aria-label="批量删除"
            disabled={selected.length === 0}
            onClick={() => setBulkConfirm(true)}
          >
            批量删除（{selected.length}）
          </Button>
          {onBulkExport ? (
            <Button
              size="sm"
              variant="outline"
              aria-label="批量导出"
              disabled={selected.length === 0}
              onClick={() => onBulkExport(selected)}
            >
              批量导出
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            aria-label="取消批量"
            onClick={() => {
              setBatch(false);
              setChecked(new Set());
            }}
          >
            取消
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkConfirm}
        title="批量删除智能体"
        message={`确认删除选中的 ${selected.length} 个智能体？`}
        confirmLabel="确认删除"
        danger
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />
    </div>
  );
}
