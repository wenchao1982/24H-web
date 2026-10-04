import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Layers,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { NATIVE_AGENTS, TASKS } from "../mocks/data";
import type { TaskItem } from "../mocks/types";
import { cn } from "../lib/cn";

const BLUEPRINTS = [
  { id: "bp-1", name: "每日站会摘要", detail: "拉取昨日变更 → 生成摘要 → 投递" },
  { id: "bp-2", name: "磁盘巡检告警", detail: "阈值检查 → 失败时通知" },
];

const DELIVERY_TARGETS = [
  { id: "dt-1", label: "运维群", platform: "Telegram" },
  { id: "dt-2", label: "#alerts", platform: "Slack" },
  { id: "dt-3", label: "邮件（admin@）", platform: "Email" },
];

const CRON_PRESETS = [
  { label: "每小时", expr: "0 * * * *" },
  { label: "每天 9 点", expr: "0 9 * * *" },
  { label: "每周一 9 点", expr: "0 9 * * 1" },
  { label: "每 30 分钟", expr: "*/30 * * * *" },
];

/** 任务：Cron 列表 + 可编辑详情 + 运行记录。 */
export function Tasks() {
  const [tasks, setTasks] = useState<TaskItem[]>(TASKS);
  const [taskId, setTaskId] = useState(TASKS[0].id);
  const [editing, setEditing] = useState<TaskItem | "new" | null>(null);
  const active = tasks.find((t) => t.id === taskId) ?? tasks[0];
  const agent = active ? NATIVE_AGENTS.find((a) => a.id === active.agentId) : undefined;

  const upsert = (task: TaskItem) => {
    setTasks((list) => {
      const exists = list.some((t) => t.id === task.id);
      return exists ? list.map((t) => (t.id === task.id ? task : t)) : [...list, task];
    });
    setTaskId(task.id);
    setEditing(null);
  };

  const remove = (id: string) => {
    setTasks((list) => list.filter((t) => t.id !== id));
    setEditing(null);
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[300px] shrink-0 flex-col border-r border-line-1">
        <div className="flex h-12 items-center gap-2 px-3">
          <h1 className="text-[14px] font-medium">任务</h1>
          <span className="rounded-pill bg-s3 px-1.5 py-px text-[10px] text-label-3">
            {tasks.length}
          </span>
          <button
            type="button"
            onClick={() =>
              setEditing({ id: `t-${Date.now()}`, name: "", schedule: "0 9 * * *", status: "enabled", agentId: "hermes" })
            }
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white hover:bg-accent-strong"
          >
            <Plus size={14} /> 新建
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-line-1 bg-s1 px-2.5 text-label-3">
            <Search size={14} />
            <input
              placeholder="搜索任务"
              className="h-full flex-1 bg-transparent text-[12.5px] text-label-1 outline-none placeholder:text-label-3"
            />
          </div>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setTaskId(task.id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left transition-colors",
                task.id === taskId ? "bg-accent-weak" : "hover:bg-s3",
              )}
            >
              <span className="flex items-center gap-1.5">
                <i
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    task.status === "enabled" ? "bg-success" : "bg-label-3",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "truncate text-[13px] font-medium",
                    task.id === taskId ? "text-accent" : "text-label-1",
                  )}
                >
                  {task.name || "（未命名）"}
                </span>
              </span>
              <span className="truncate font-mono text-[11px] text-label-3">{task.schedule}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="thin-scroll min-w-0 flex-1 overflow-y-auto px-6 py-5">
        {active ? (
          <div className="mx-auto max-w-[720px]">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold">{active.name || "（未命名）"}</h2>
              <span
                className={cn(
                  "rounded-pill px-2 py-0.5 text-[11px] font-medium",
                  active.status === "enabled" ? "bg-accent-weak text-accent" : "bg-s3 text-label-3",
                )}
              >
                {active.status === "enabled" ? "已启用" : "已暂停"}
              </span>
              <button
                type="button"
                onClick={() => setEditing(active)}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2"
              >
                <Pencil size={14} /> 编辑
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Field label="任务计划（Cron）" mono value={active.schedule} />
              <Field label="绑定智能体" value={agent?.name ?? "—"} />
              <Field label="上次运行" value={active.last ?? "—"} />
              <Field label="预计下次" value={active.next ?? "—"} />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong"
              >
                <Play size={14} /> 立即运行
              </button>
              <button
                type="button"
                onClick={() =>
                  setTasks((list) =>
                    list.map((t) =>
                      t.id === active.id
                        ? { ...t, status: t.status === "enabled" ? "paused" : "enabled" }
                        : t,
                    ),
                  )
                }
                className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2"
              >
                {active.status === "enabled" ? "暂停" : "恢复"}
              </button>
              <button
                type="button"
                onClick={() => remove(active.id)}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] text-danger hover:bg-s2"
              >
                <Trash2 size={14} /> 删除
              </button>
            </div>

            <div className="mt-6">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] text-label-3">
                <CalendarClock size={13} /> 运行记录
              </p>
              <div className="flex flex-col gap-1.5">
                {[
                  { at: active.last ?? "今天 09:00", status: "成功", ms: "1.2s", err: "" },
                  { at: "昨天 09:00", status: "成功", ms: "1.4s", err: "" },
                  {
                    at: "前天 09:00",
                    status: "失败",
                    ms: "—",
                    err: "上游连接超时（HERMES_UNREACHABLE）；已重试 1 次",
                  },
                ].map((run, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 rounded-md border border-line-1 bg-s1 px-3 py-2 text-[12.5px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-label-2">{run.at}</span>
                      <span className="text-label-3">{run.ms}</span>
                      <span className="flex-1" />
                      <span className={run.status === "成功" ? "text-success" : "text-danger"}>
                        {run.status}
                      </span>
                    </div>
                    {run.err ? (
                      <p className="flex items-center gap-1.5 text-[11.5px] text-danger">
                        <AlertTriangle size={12} /> {run.err}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <section className="rounded-lg border border-line-1 bg-s1 p-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] text-label-3">
                  <Layers size={13} /> 蓝图
                </p>
                <div className="flex flex-col gap-2">
                  {BLUEPRINTS.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-label-1">{b.name}</span>
                        <span className="block text-[11px] text-label-3">{b.detail}</span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-line-1 px-2 py-0.5 text-[11px] text-label-2 hover:bg-s2"
                      >
                        实例化
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-lg border border-line-1 bg-s1 p-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] text-label-3">
                  <Send size={13} /> 投递目标
                </p>
                <div className="flex flex-col gap-1.5">
                  {DELIVERY_TARGETS.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-[12.5px]">
                      <span className="text-label-1">{t.label}</span>
                      <span className="ml-auto text-[11px] text-label-3">{t.platform}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <p className="mt-10 text-center text-[13px] text-label-3">暂无任务。</p>
        )}
      </div>

      {editing ? (
        <TaskModal
          task={editing === "new" ? null : editing}
          onSave={upsert}
          onDelete={editing === "new" ? undefined : () => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-line-1 bg-s1 px-3 py-2">
      <p className="text-[11px] text-label-3">{label}</p>
      <p className={cn("mt-0.5 text-[13px] text-label-1", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function TaskModal({
  task,
  onSave,
  onDelete,
  onClose,
}: {
  task: TaskItem | null;
  onSave: (task: TaskItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskItem>(
    task ?? { id: `t-${Date.now()}`, name: "", schedule: "0 9 * * *", status: "enabled", agentId: "hermes" },
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(15_17_21_/_45%)]" onClick={onClose}>
      <div
        className="w-[480px] max-w-[90%] rounded-lg border border-line-1 bg-s1 shadow-[0_8px_24px_rgb(15_17_21_/_16%)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line-1 px-4 py-3 text-[14px] font-medium">
          {task ? "编辑任务" : "新建任务"}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">名称</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="任务名称"
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">任务计划（Cron）</span>
            <input
              value={draft.schedule}
              onChange={(e) => setDraft({ ...draft, schedule: e.target.value })}
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 font-mono text-[13px] outline-none focus:border-accent/50"
            />
            <span className="flex flex-wrap gap-1.5 pt-0.5">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.expr}
                  type="button"
                  onClick={() => setDraft({ ...draft, schedule: p.expr })}
                  className="rounded-pill border border-line-1 px-2 py-0.5 text-[11px] text-label-2 hover:bg-s2"
                >
                  {p.label}
                </button>
              ))}
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">绑定智能体</span>
            <select
              value={draft.agentId}
              onChange={(e) => setDraft({ ...draft, agentId: e.target.value })}
              className="h-9 rounded-md border border-line-1 bg-s1 px-2 text-[13px] text-label-1 outline-none"
            >
              {NATIVE_AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between">
            <span className="text-[12px] text-label-2">启用</span>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, status: draft.status === "enabled" ? "paused" : "enabled" })}
              className={cn(
                "flex h-5 w-9 items-center rounded-pill px-0.5",
                draft.status === "enabled" ? "justify-end bg-accent" : "bg-s3",
              )}
            >
              <span className="h-4 w-4 rounded-full bg-white shadow" />
            </button>
          </label>
        </div>
        <div className="flex items-center gap-2 border-t border-line-1 px-4 py-3">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] text-danger hover:bg-s2"
            >
              <Trash2 size={14} /> 删除
            </button>
          ) : null}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">
            取消
          </button>
          <button
            type="button"
            disabled={!draft.name.trim()}
            onClick={() => onSave(draft)}
            className="h-8 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
