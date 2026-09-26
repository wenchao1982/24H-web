import type { SessionSummary } from "./types";

export interface SessionListProps {
  sessions: SessionSummary[];
  activeId: string | null;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate?: () => void;
}

export default function SessionList({
  sessions,
  activeId,
  filter,
  onFilterChange,
  onSelect,
  onCreate,
}: SessionListProps) {
  return (
    <div className="session-list">
      <div className="session-list-head">
        <input
          className="session-search"
          type="search"
          aria-label="会话搜索"
          placeholder="搜索会话"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
        {onCreate ? (
          <button type="button" className="primary session-new" aria-label="新建会话" onClick={onCreate}>
            新建
          </button>
        ) : null}
      </div>

      {sessions.length === 0 ? (
        <p className="empty session-empty">暂无会话</p>
      ) : (
        <ul className="session-items">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className="session-item"
                data-active={session.id === activeId}
                aria-current={session.id === activeId ? "true" : undefined}
                onClick={() => onSelect(session.id)}
              >
                {session.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
