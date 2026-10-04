import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Input } from "../ui";
import {
  BOARD_COLUMNS,
  createTask,
  deleteTask,
  dispatch,
  exportBoard,
  fetchBoard,
  fetchBoards,
  updateTaskStatus,
  type KanbanBoard,
  type KanbanBoardSummary,
  type KanbanStatus,
} from "./kanban";
import { useHermesStream } from "./useHermesStream";
import TaskDetail from "./TaskDetail";

const STATUS_LABEL: Record<KanbanStatus, string> = {
  triage: "Triage",
  todo: "Todo",
  scheduled: "Scheduled",
  ready: "Ready",
  running: "Running",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

/** 看板（Hermes Kanban 插件）：8 列 = board 状态；新建/移动/删除/dispatch。 */
export default function KanbanPage() {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [boards, setBoards] = useState<KanbanBoardSummary[]>([]);
  const [boardSlug, setBoardSlug] = useState<string | null>(null);

  const loadBoards = useCallback(async () => {
    try {
      const list = await fetchBoards();
      setBoards(list.boards);
      setBoardSlug((current) => current ?? list.current);
    } catch {
      // 切换器加载失败不阻断看板本身
    }
  }, []);

  const load = useCallback(async (slug: string | null) => {
    setLoading(true);
    try {
      setBoard(await fetchBoard(slug));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载看板");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    void load(boardSlug);
  }, [boardSlug, load]);

  // M20：订阅看板事件流，有新事件即刷新（无 WebSocket 环境静默跳过）。
  useHermesStream("/api/plugins/kanban/events", () => {
    void load(boardSlug);
  });

  const total = useMemo(
    () => (board ? BOARD_COLUMNS.reduce((sum, name) => sum + board.columns[name].length, 0) : 0),
    [board],
  );

  const run = async (action: () => Promise<unknown>, okMessage?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (okMessage) {
        setMessage(okMessage);
      }
      await load(boardSlug);
      await loadBoards();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) {
      return;
    }
    void run(async () => {
      await createTask({ title: trimmed, ...(assignee.trim() ? { assignee: assignee.trim() } : {}) });
      setTitle("");
      setAssignee("");
    }, "已创建任务");
  };

  return (
    <div className="kanban-page">
      <div className="kanban-toolbar">
        <h1 className="kanban-title">看板</h1>
        <span className="muted kanban-count">{total} 任务</span>
        <form className="kanban-create" onSubmit={submit}>
          <Input
            aria-label="新任务标题"
            placeholder="新任务标题"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            aria-label="指派"
            placeholder="指派（profile）"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          />
          <Button variant="primary" type="submit" disabled={busy || title.trim() === ""}>
            新建任务
          </Button>
        </form>
        <Button variant="outline" type="button" disabled={busy} onClick={() => void run(dispatch, "已触发 dispatch")}>
          Dispatch
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={busy || !boardSlug}
          onClick={() =>
            void run(async () => {
              await exportBoard(boardSlug as string);
            }, "已导出看板")
          }
        >
          导出
        </Button>
      </div>

      {boards.length > 0 ? (
        <div className="kanban-board-tabs" role="tablist" aria-label="看板切换">
          {boards.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              role="tab"
              className="kanban-board-tab"
              aria-selected={entry.slug === boardSlug}
              onClick={() => setBoardSlug(entry.slug)}
            >
              {entry.name}
              <span className="kanban-board-count">{entry.total}</span>
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="muted" role="status">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="empty">加载看板中…</p>
      ) : (
        <div className="kanban-board">
          {BOARD_COLUMNS.map((column) => (
            <section key={column} className="kanban-column" aria-label={STATUS_LABEL[column]}>
              <header className="kanban-column-head">
                <span className="kanban-column-name">{STATUS_LABEL[column]}</span>
                <span className="kanban-column-count">{board?.columns[column].length ?? 0}</span>
              </header>
              <div className="kanban-column-body">
                {(board?.columns[column] ?? []).map((task) => (
                  <article key={task.id} className="kanban-card">
                    <button
                      type="button"
                      className="kanban-card-title kanban-card-open"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      {task.title}
                    </button>
                    {task.latestSummary ? (
                      <p className="kanban-card-summary">{task.latestSummary}</p>
                    ) : null}
                    <div className="kanban-card-meta">
                      <span className="muted">{task.assignee ?? "未指派"}</span>
                      <label className="kanban-move">
                        <span className="sr-only">移动 {task.title}</span>
                        <select
                          aria-label={`移动 ${task.title}`}
                          value={task.status}
                          disabled={busy}
                          onChange={(event) =>
                            void run(
                              () => updateTaskStatus(task.id, event.target.value as KanbanStatus),
                              `已移动到 ${STATUS_LABEL[event.target.value as KanbanStatus]}`,
                            )
                          }
                        >
                          {BOARD_COLUMNS.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="ghost danger kanban-delete"
                        disabled={busy}
                        aria-label={`删除任务 ${task.title}`}
                        onClick={() => void run(() => deleteTask(task.id), "已删除任务")}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedTaskId ? (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      ) : null}
    </div>
  );
}
