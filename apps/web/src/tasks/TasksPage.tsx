import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { normalizeCronJobs, type CronJob } from "./cron";

type CronAction = "pause" | "resume" | "remove" | "trigger";

/** 任务页：Cron 任务列表 + 新增/暂停/恢复/删除/立即运行（M7 / T9.1、T9.2）。 */
export default function TasksPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(normalizeCronJobs(await api<unknown>("/api/hermes/cron/jobs")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载任务列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, action: CronAction) => {
    setBusy(`${id}:${action}`);
    try {
      await api(`/api/hermes/cron/jobs/${encodeURIComponent(id)}/${action}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务操作失败");
    } finally {
      setBusy(null);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !schedule.trim() || busy) {
      return;
    }
    setBusy("create");
    try {
      await api("/api/hermes/cron/jobs", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), schedule: schedule.trim() }),
      });
      setName("");
      setSchedule("");
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增任务失败");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="empty">加载任务中…</p>;
  }

  return (
    <div className="page tasks-page">
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <form className="card" onSubmit={create}>
        <h3>新增任务</h3>
        <div className="row">
          <input
            aria-label="任务名称"
            placeholder="任务名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            aria-label="任务计划"
            placeholder="cron 表达式，如 0 9 * * *"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
          />
          <button className="primary" type="submit" disabled={busy === "create"}>
            新增
          </button>
        </div>
      </form>

      <div className="card">
        <h3>定时任务</h3>
        {jobs.length === 0 ? (
          <p className="empty">暂无定时任务。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>计划</th>
                <th>下次运行</th>
                <th>上次状态</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.schedule || "—"}</td>
                  <td>{job.nextRun || "—"}</td>
                  <td>{job.lastStatus || "—"}</td>
                  <td>{job.enabled ? "已启用" : "已暂停"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void run(job.id, job.enabled ? "pause" : "resume")}
                      >
                        {job.enabled ? "暂停" : "恢复"}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void run(job.id, "trigger")}
                      >
                        立即运行
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={busy !== null}
                        onClick={() => void run(job.id, "remove")}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
