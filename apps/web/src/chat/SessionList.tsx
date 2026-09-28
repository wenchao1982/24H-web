import { useState } from "react";
import { Button, ConfirmDialog, EmptyState, IconButton } from "../ui";
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
  onPrune?: () => void;
  onBulkDelete?: (ids: string[]) => void;
}

type ConfirmState =
  | { kind: "prune" }
  | { kind: "delete"; id: string; title: string }
  | { kind: "bulk" }
  | null;

interface SessionRowProps {
  session: SessionSummary;
  active: boolean;
  batch: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onResume?: (id: string) => void;
  onRequestDelete: (session: SessionSummary) => void;
}

function SessionRow({
  session,
  active,
  batch,
  selected,
  onSelect,
  onToggleSelect,
  onRename,
  onResume,
  onRequestDelete,
}: SessionRowProps) {
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
      {batch ? (
        <input
          type="checkbox"
          className="session-check"
          aria-label={`选择 ${session.title}`}
          checked={selected}
          onChange={() => onToggleSelect(session.id)}
        />
      ) : null}
      <button
        type="button"
        className="session-item"
        data-active={active}
        aria-current={active ? "true" : undefined}
        onClick={() => (batch ? onToggleSelect(session.id) : onSelect(session.id))}
      >
        {session.title}
      </button>
      {!batch ? (
        <div className="session-row-actions">
          {onRename ? (
            <IconButton
              className="session-quick-btn"
              label={`重命名会话 ${session.title}`}
              icon="edit"
              size={14}
              onClick={() => {
                setDraft(session.title);
                setEditing(true);
              }}
            />
          ) : null}
          <IconButton
            className="session-quick-btn"
            label={`删除会话 ${session.title}`}
            icon="trash"
            size={14}
            tone="danger"
            onClick={() => onRequestDelete(session)}
          />
        </div>
      ) : null}
      {!batch ? (
        <>
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
                  onRequestDelete(session);
                }}
              >
                删除
              </button>
            </div>
          ) : null}
        </>
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
  onPrune,
  onBulkDelete,
}: SessionListProps) {
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const toggleSelect = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  const exitBatch = () => {
    setBatch(false);
    setSelected([]);
  };

  const handleConfirm = () => {
    if (!confirm) {
      return;
    }
    if (confirm.kind === "prune") {
      onPrune?.();
    } else if (confirm.kind === "delete") {
      onDelete?.(confirm.id);
    } else {
      onBulkDelete?.(selected);
      exitBatch();
    }
    setConfirm(null);
  };

  const confirmTitle =
    confirm?.kind === "prune"
      ? "清理旧会话"
      : confirm?.kind === "delete"
        ? "删除会话"
        : "批量删除会话";
  const confirmMessage =
    confirm?.kind === "prune"
      ? "将清理已结束的旧会话，确认继续？"
      : confirm?.kind === "delete"
        ? `确认删除会话「${confirm.title}」？`
        : `确认删除选中的 ${selected.length} 个会话？`;

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
          <button type="button" className="primary session-new" onClick={onCreate}>
            新建
          </button>
        ) : null}
        {onPrune || onBulkDelete ? (
          <div className="session-more">
            <IconButton
              className="session-more-btn"
              label="更多"
              icon="more"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((value) => !value)}
            />
            {moreOpen ? (
              <div className="session-more-menu" role="menu">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    if (batch) {
                      exitBatch();
                    } else {
                      setBatch(true);
                      setSelected([]);
                    }
                  }}
                >
                  {batch ? "退出批量" : "批量选择"}
                </button>
                {onPrune ? (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setMoreOpen(false);
                      setConfirm({ kind: "prune" });
                    }}
                  >
                    清理旧会话
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {batch ? (
        <div className="session-batch-bar">
          <Button
            variant="danger-solid"
            size="sm"
            disabled={selected.length === 0}
            onClick={() => setConfirm({ kind: "bulk" })}
          >
            批量删除（{selected.length}）
          </Button>
          <Button variant="ghost" size="sm" onClick={exitBatch}>
            取消
          </Button>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          icon="chat"
          title="暂无会话"
          description="点击上方『新建』开始第一次对话"
        />
      ) : (
        <ul className="session-items">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              active={session.id === activeId}
              batch={batch}
              selected={selected.includes(session.id)}
              onSelect={onSelect}
              onToggleSelect={toggleSelect}
              onRename={onRename}
              onResume={onResume}
              onRequestDelete={(entry) =>
                setConfirm({ kind: "delete", id: entry.id, title: entry.title })
              }
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirm?.kind === "prune" ? "确认清理" : "确认删除"}
        danger={confirm?.kind !== "prune"}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
