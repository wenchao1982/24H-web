import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeCronJobs, type CronJob } from "./cron";

/** 任务页：Cron 任务列表（M7 / T9.1）。 */
export default function TasksPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
