import { useState } from "react";
import type { SessionSummary } from "./types";

export interface SessionListProps {
  sessions: SessionSummary[];
  activeId: string | null;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onResume?: (id: string) => void;
}

interface SessionRowProps {
  session: SessionSummary;
  active: boolean;
  onSelect: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onResume?: (id: string) => void;
}

function SessionRow({ session, active, onSelect, onRename, onDelete, onResume }: SessionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);

  if (editing) {
    return (
      <li className="session-row" data-editing="true">
        <form
          className="session-rename"
          onSubmit={(event) => {
            event.preventDefault();
            const title = draft.trim();
            if (title) {
              onRename?.(session.id, title);
            }
            setEditing(false);
          }}
        >
          <input
            className="session-search"
            aria-label={`重命名 ${session.title}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="primary">
            确定
          </button>
          <button type="button" className="ghost" onClick={() => setEditing(false)}>
            取消
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="session-row">
      <button
        type="button"
        className="session-item"
        data-active={active}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(session.id)}
      >
        {session.title}
      </button>
      <button
        type="button"
        className="icon-btn session-menu-btn"
        aria-label={`会话操作 ${session.title}`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      >
        ⋯
      </button>
      {menuOpen ? (
        <div className="session-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setDraft(session.title);
              setEditing(true);
              setMenuOpen(false);
            }}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onResume?.(session.id);
            }}
          >
            恢复
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setMenuOpen(false);
              onDelete?.(session.id);
            }}
          >
            删除
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default function SessionList({
  sessions,
  activeId,
  filter,
  onFilterChange,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onResume,
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
            <SessionRow
              key={session.id}
              session={session}
              active={session.id === activeId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onResume={onResume}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
