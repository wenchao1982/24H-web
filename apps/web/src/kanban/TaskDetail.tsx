import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  fetchTask,
  subscribeHome,
  unsubscribeHome,
  type KanbanTaskDetail,
} from "./kanban";

const HOME_PLATFORMS = ["telegram", "discord", "slack"];

export interface TaskDetailProps {
  taskId: string;
  onClose: () => void;
}

const STATUS_TEXT: Record<string, string> = {
  triage: "Triage",
  todo: "Todo",
  scheduled: "Scheduled",
  ready: "Ready",
  running: "Running",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

/** 卡片详情抽屉：`GET /api/plugins/kanban/tasks/:id`（评论/附件/runs/links）。 */
export default function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const [detail, setDetail] = useState<KanbanTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState("telegram");
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeMessage, setHomeMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchTask(taskId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载任务详情");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribe = async (action: "subscribe" | "unsubscribe") => {
    setHomeBusy(true);
    setHomeMessage(null);
    try {
      if (action === "subscribe") {
        await subscribeHome(taskId, platform);
        setHomeMessage(`已订阅 ${platform}`);
      } else {
        await unsubscribeHome(taskId, platform);
        setHomeMessage(`已退订 ${platform}`);
      }
    } catch (err) {
      setHomeMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setHomeBusy(false);
    }
  };

  const task = detail?.task ?? null;

  return (
    <aside className="task-detail" aria-label="任务详情">
      <header className="task-detail-head">
        <h2 className="task-detail-title">{task?.title ?? "任务详情"}</h2>
        <button type="button" className="icon-btn" aria-label="关闭详情" onClick={onClose}>
          ×
        </button>
      </header>

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="empty">加载中…</p>
      ) : task ? (
        <div className="task-detail-body">
          <div className="task-detail-meta">
            <span className="tag">{STATUS_TEXT[task.status] ?? task.status}</span>
            <span className="muted">{task.assignee ?? "未指派"}</span>
            {task.priority ? <span className="muted">P{task.priority}</span> : null}
          </div>

          {task.latestSummary ? <p className="task-detail-summary">{task.latestSummary}</p> : null}

          <Section title={`评论（${detail?.comments.length ?? 0}）`}>
            {detail && detail.comments.length > 0 ? (
              <ul className="task-detail-list">
                {detail.comments.map((comment) => (
                  <li key={comment.id}>
                    <span className="muted">{comment.author ?? "匿名"}：</span>
                    {comment.body}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">暂无评论。</p>
            )}
          </Section>

          <Section title={`附件（${detail?.attachments.length ?? 0}）`}>
            {detail && detail.attachments.length > 0 ? (
              <ul className="task-detail-list">
                {detail.attachments.map((attachment) => (
                  <li key={attachment.id} className="mono">
                    {attachment.filename}
                    {attachment.size != null ? ` · ${attachment.size}B` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">暂无附件。</p>
            )}
          </Section>

          <Section title={`运行（${detail?.runs.length ?? 0}）`}>
            {detail && detail.runs.length > 0 ? (
              <ul className="task-detail-list">
                {detail.runs.map((run) => (
                  <li key={run.id}>
                    <span className="mono">#{run.id}</span> {run.status ?? run.outcome ?? "—"}
                    {run.summary ? `：${run.summary}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">暂无运行记录。</p>
            )}
          </Section>

          {detail && detail.linkTasks.length > 0 ? (
            <Section title="关联任务">
              <ul className="task-detail-list">
                {detail.linkTasks.map((link) => (
                  <li key={link.id}>
                    {link.title} <span className="muted">（{STATUS_TEXT[link.status] ?? link.status}）</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Home 订阅">
            <div className="task-detail-home">
              <select
                aria-label="Home 平台"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
              >
                {HOME_PLATFORMS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ghost"
                disabled={homeBusy}
                onClick={() => void subscribe("subscribe")}
              >
                订阅
              </button>
              <button
                type="button"
                className="ghost"
                disabled={homeBusy}
                onClick={() => void subscribe("unsubscribe")}
              >
                退订
              </button>
            </div>
            {homeMessage ? <p className="muted">{homeMessage}</p> : null}
          </Section>
        </div>
      ) : (
        <p className="empty">任务不存在。</p>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="task-detail-section">
      <h3 className="task-detail-section-title">{title}</h3>
      {children}
    </section>
  );
}
