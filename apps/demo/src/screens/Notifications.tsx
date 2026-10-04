import { AlertTriangle, Bell, CheckCircle2, MessageCircleQuestion, ShieldQuestion } from "lucide-react";
import { NOTIFICATIONS } from "../mocks/data";
import type { NotificationKind } from "../mocks/types";
import { cn } from "../lib/cn";

const KIND: Record<NotificationKind, { icon: typeof Bell; className: string; label: string }> = {
  approval: { icon: ShieldQuestion, className: "text-warning", label: "审批" },
  clarify: { icon: MessageCircleQuestion, className: "text-accent", label: "回答" },
  done: { icon: CheckCircle2, className: "text-success", label: "完成" },
  error: { icon: AlertTriangle, className: "text-danger", label: "失败" },
};

const PREFS: { id: NotificationKind; label: string; on: boolean }[] = [
  { id: "approval", label: "审批请求", on: true },
  { id: "clarify", label: "需要回答", on: true },
  { id: "done", label: "任务完成", on: false },
  { id: "error", label: "任务失败", on: true },
];

/** 通知：未读/挂起聚合 + 偏好。 */
export function Notifications() {
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <div className="flex h-full min-h-0">
      <div className="thin-scroll min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-4 flex items-center gap-2">
            <h1 className="text-[18px] font-semibold">通知</h1>
            {unread > 0 ? (
              <span className="rounded-pill bg-accent-weak px-2 py-0.5 text-[11px] font-medium text-accent">
                {unread} 未读
              </span>
            ) : null}
            <button type="button" className="ml-auto text-[12.5px] text-label-3 hover:text-label-1">
              全部标为已读
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {NOTIFICATIONS.map((n) => {
              const meta = KIND[n.kind];
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors hover:bg-s2",
                    n.unread ? "border-line-2 bg-s1" : "border-line-1 bg-s1/60",
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    <Icon size={17} className={meta.className} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-label-1">{n.title}</span>
                      {n.unread ? <i className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" /> : null}
                    </span>
                    {n.detail ? <span className="mt-0.5 block truncate text-[12px] text-label-3">{n.detail}</span> : null}
                  </span>
                  <span className="shrink-0 text-[11px] text-label-3">{n.at}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hidden w-[280px] shrink-0 border-l border-line-1 p-4 lg:block">
        <p className="mb-3 text-[13px] font-medium">偏好</p>
        <div className="flex flex-col gap-2.5">
          {PREFS.map((p) => (
            <label key={p.id} className="flex items-center justify-between text-[12.5px] text-label-2">
              {p.label}
              <span
                className={cn(
                  "flex h-5 w-9 items-center rounded-pill px-0.5",
                  p.on ? "justify-end bg-accent" : "bg-s3",
                )}
                aria-hidden="true"
              >
                <span className="h-4 w-4 rounded-full bg-white shadow" />
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
