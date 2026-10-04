import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { ConfirmDialog, EmptyState, Skeleton, Tag, type TagTone } from "../ui";
import {
  CRON_TEMPLATES,
  nextCronRun,
  normalizeBlueprints,
  normalizeCronJobs,
  normalizeDeliveryTargets,
  normalizeRuns,
  type CronBlueprint,
  type CronJob,
  type CronRun,
  type DeliveryTarget,
} from "./cron";

type CronAction = "pause" | "resume" | "remove" | "trigger";

const LIST_NOTE = "定时任务将按照设定时间自动唤起智能体执行任务";

function lastStatusTone(status: string): TagTone {
  const value = status.toLowerCase();
  if (value.includes("error") || value.includes("fail")) {
    return "danger";
  }
  if (value === "ok") {
    return "success";
  }
  return "neutral";
}

function localTimeText(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
}

/** 任务页：Cron 任务列表 + 新增/暂停/恢复/删除/立即运行（M7 / T9.1、T9.2）。 */
export default function TasksPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [targets, setTargets] = useState<DeliveryTarget[]>([]);
  const [blueprints, setBlueprints] = useState<CronBlueprint[]>([]);
  const [runsJob, setRunsJob] = useState<string | null>(null);
  const [runs, setRuns] = useState<CronRun[]>([]);

  const preview = useMemo(() => {
    if (!schedule.trim()) {
      return null;
    }
    return nextCronRun(schedule);
  }, [schedule]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsPayload, targetsPayload, blueprintsPayload] = await Promise.all([
        api<unknown>("/api/hermes/cron/jobs"),
        api<unknown>("/api/hermes/cron/delivery-targets").catch(() => null),
        api<unknown>("/api/hermes/cron/blueprints").catch(() => null),
      ]);
      setJobs(normalizeCronJobs(jobsPayload));
      setTargets(targetsPayload ? normalizeDeliveryTargets(targetsPayload) : []);
      setBlueprints(blueprintsPayload ? normalizeBlueprints(blueprintsPayload) : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载任务列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const instantiate = async (blueprintId: string) => {
    setBusy(`bp:${blueprintId}`);
    try {
      await api("/api/hermes/cron/blueprints/instantiate", {
        method: "POST",
        body: JSON.stringify({ blueprint_id: blueprintId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "实例化蓝图失败");
    } finally {
      setBusy(null);
    }
  };

  const showRuns = async (id: string) => {
    setRunsJob(id);
    setRuns([]);
    try {
      setRuns(normalizeRuns(await api<unknown>(`/api/hermes/cron/jobs/${encodeURIComponent(id)}/runs`)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载运行历史失败");
    }
  };

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
    return (
      <div className="page tasks-page" role="status" aria-label="加载任务中">
        <div className="card tasks-skeleton">
          <Skeleton width={120} height={20} />
          <div className="tasks-skeleton-rows">
            <Skeleton height={32} />
            <Skeleton height={32} />
            <Skeleton height={32} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page tasks-page">
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <form className="card tasks-form" onSubmit={create}>
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
        <div className="cron-templates">
          {CRON_TEMPLATES.map((template) => (
            <button
              key={template.expr}
              type="button"
              className="cron-template"
              onClick={() => setSchedule(template.expr)}
            >
              {template.label}
            </button>
          ))}
        </div>
        <p className="cron-hint">
          Cron 是定时表达式，用于定义任务触发时间（分 时 日 月 周）
        </p>
        {schedule.trim() ? (
          <p className="cron-preview" aria-label="下次执行预览">
            {preview ? `预计下次执行：${preview.toLocaleString()}` : "无法解析该表达式"}
          </p>
        ) : null}
      </form>

      <div className="card">
        <h3>定时任务</h3>
        {jobs.length === 0 ? (
          <EmptyState icon="tasks" title="暂无定时任务。" description={LIST_NOTE} />
        ) : (
          <>
            <p className="tasks-note">{LIST_NOTE}</p>
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
                    <td title={localTimeText(job.nextRun)}>{job.nextRun || "—"}</td>
                    <td>
                      <Tag tone={lastStatusTone(job.lastStatus)}>{job.lastStatus || "—"}</Tag>
                    </td>
                    <td>
                      {job.enabled ? (
                        <Tag tone="success">已启用</Tag>
                      ) : (
                        <Tag tone="neutral">已暂停</Tag>
                      )}
                    </td>
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
                        <button type="button" onClick={() => void showRuns(job.id)}>
                          运行历史
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busy !== null}
                          onClick={() => setDeleteTarget(job.id)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h3>投递目标</h3>
        {targets.length === 0 ? (
          <p className="muted">暂无投递目标。</p>
        ) : (
          <div className="row">
            {targets.map((target) => (
              <Tag key={target.id} tone="neutral">
                {target.label}
                {target.platform ? ` · ${target.platform}` : ""}
              </Tag>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>蓝图</h3>
        {blueprints.length === 0 ? (
          <p className="muted">暂无蓝图。</p>
        ) : (
          <ul className="task-detail-list">
            {blueprints.map((blueprint) => (
              <li key={blueprint.id}>
                <strong>{blueprint.name}</strong>
                {blueprint.description ? <span className="muted"> — {blueprint.description}</span> : null}
                <button
                  type="button"
                  className="ghost"
                  disabled={busy !== null}
                  onClick={() => void instantiate(blueprint.id)}
                >
                  实例化
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {runsJob ? (
        <div className="card">
          <div className="row">
            <h3>运行历史 · {runsJob}</h3>
            <button type="button" className="ghost" onClick={() => setRunsJob(null)}>
              关闭
            </button>
          </div>
          {runs.length === 0 ? (
            <p className="muted">暂无记录或全部成功。</p>
          ) : (
            <ul className="task-detail-list">
              {runs.map((entry) => (
                <li key={entry.id}>
                  <Tag tone={entry.status.toLowerCase().includes("fail") ? "danger" : "neutral"}>
                    {entry.status || "unknown"}
                  </Tag>
                  <span className="muted"> {entry.startedAt}</span>
                  {entry.message ? <span> — {entry.message}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除任务"
        message={`删除后调度将停止，确认删除任务「${deleteTarget ?? ""}」？`}
        confirmLabel="确认删除"
        danger
        onConfirm={() => {
          const id = deleteTarget;
          setDeleteTarget(null);
          if (id) {
            void run(id, "remove");
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
