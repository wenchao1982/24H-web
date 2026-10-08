import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { ConfirmDialog, EmptyState, Modal, Skeleton, Tag, type TagTone } from "../ui";
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

/** 任务页：左列表 + 右详情（新建/暂停/恢复/删除/立即运行 + 运行历史/蓝图/投递）。 */
export default function TasksPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");

  const [targets, setTargets] = useState<DeliveryTarget[]>([]);
  const [blueprints, setBlueprints] = useState<CronBlueprint[]>([]);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [runsJobsId, setRunsJobsId] = useState<string | null>(null);

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
      const nextJobs = normalizeCronJobs(jobsPayload);
      setJobs(nextJobs);
      setSelectedId((current) =>
        current && nextJobs.some((job) => job.id === current) ? current : nextJobs[0]?.id ?? null,
      );
      setTargets(targetsPayload ? normalizeDeliveryTargets(targetsPayload) : []);
      setBlueprints(blueprintsPayload ? normalizeBlueprints(blueprintsPayload) : []);
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

  const selected = jobs.find((job) => job.id === selectedId) ?? null;

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
      setCreateOpen(false);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增任务失败");
    } finally {
      setBusy(null);
    }
  };

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
    setRunsJobsId(id);
    setRuns([]);
    try {
      setRuns(normalizeRuns(await api<unknown>(`/api/hermes/cron/jobs/${encodeURIComponent(id)}/runs`)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载运行历史失败");
    }
  };

  if (loading) {
    return (
      <div className="page tasks-page">
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
    <div className="tasks-split">
      <aside className="tasks-list" aria-label="任务列表">
        <div className="tasks-list-head">
          <h1 className="tasks-list-title">任务</h1>
          <span className="muted">{jobs.length}</span>
          <button type="button" className="primary" onClick={() => setCreateOpen(true)}>
            新建
          </button>
        </div>
        {jobs.length === 0 ? (
          <EmptyState icon="tasks" title="暂无定时任务。" description={LIST_NOTE} />
        ) : (
          <ul className="tasks-rows">
            {jobs.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  className="task-row"
                  data-active={job.id === selectedId}
                  aria-current={job.id === selectedId ? "true" : undefined}
                  onClick={() => setSelectedId(job.id)}
                >
                  <span className="task-row-name">
                    <i className="dot" data-on={job.enabled} aria-hidden="true" />
                    {job.id}
                  </span>
                  <span className="task-row-schedule mono">{job.schedule || "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="tasks-detail">
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        {!selected ? (
          <p className="empty">选择或新建一个任务。</p>
        ) : (
          <div className="tasks-detail-inner">
            <div className="tasks-detail-head">
              <h2>{selected.id}</h2>
              <Tag tone={selected.enabled ? "success" : "neutral"}>
                {selected.enabled ? "已启用" : "已暂停"}
              </Tag>
            </div>

            <div className="tasks-fields">
              <div className="field-card">
                <span className="field-card-label">任务计划（Cron）</span>
                <span className="field-card-value mono">{selected.schedule || "—"}</span>
              </div>
              <div className="field-card">
                <span className="field-card-label">上次状态</span>
                <span className="field-card-value">
                  <Tag tone={lastStatusTone(selected.lastStatus)}>{selected.lastStatus || "—"}</Tag>
                </span>
              </div>
              <div className="field-card">
                <span className="field-card-label">预计下次</span>
                <span className="field-card-value" title={localTimeText(selected.nextRun)}>
                  {selected.nextRun || "—"}
                </span>
              </div>
            </div>

            <div className="tasks-actions">
              <button
                type="button"
                className="primary"
                disabled={busy !== null}
                onClick={() => void run(selected.id, "trigger")}
              >
                立即运行
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run(selected.id, selected.enabled ? "pause" : "resume")}
              >
                {selected.enabled ? "暂停" : "恢复"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void showRuns(selected.id)}
              >
                运行历史
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy !== null}
                onClick={() => setDeleteTarget(selected.id)}
                style={{ marginLeft: "auto" }}
              >
                删除
              </button>
            </div>

            {runsJobsId === selected.id ? (
              <section className="tasks-subsection">
                <h3>运行记录</h3>
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
              </section>
            ) : null}

            <section className="tasks-subsection">
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
            </section>

            <section className="tasks-subsection">
              <h3>蓝图</h3>
              {blueprints.length === 0 ? (
                <p className="muted">暂无蓝图。</p>
              ) : (
                <ul className="task-detail-list">
                  {blueprints.map((blueprint) => (
                    <li key={blueprint.id}>
                      <strong>{blueprint.name}</strong>
                      {blueprint.description ? (
                        <span className="muted"> — {blueprint.description}</span>
                      ) : null}
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
            </section>
          </div>
        )}
      </section>

      <Modal
        open={createOpen}
        title="新建任务"
        onClose={() => setCreateOpen(false)}
      >
        <form className="tasks-create" onSubmit={create}>
          <label className="config-row">
            <span>任务名称</span>
            <input
              aria-label="任务名称"
              placeholder="任务名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="config-row">
            <span>任务计划</span>
            <input
              aria-label="任务计划"
              placeholder="cron 表达式，如 0 9 * * *"
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
            />
          </label>
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
          {schedule.trim() ? (
            <p className="cron-preview" aria-label="下次执行预览">
              {preview ? `预计下次执行：${preview.toLocaleString()}` : "无法解析该表达式"}
            </p>
          ) : null}
          <div className="row">
            <button className="primary" type="submit" disabled={busy === "create"}>
              新增
            </button>
            <button type="button" className="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </button>
          </div>
        </form>
      </Modal>

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
