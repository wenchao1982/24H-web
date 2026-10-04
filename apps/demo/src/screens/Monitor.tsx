import { Activity, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { MONITOR_METRICS, MONITOR_PROCESSES } from "../mocks/data";
import type { MonitorMetric } from "../mocks/types";
import { cn } from "../lib/cn";

const ICON = [Cpu, MemoryStick, HardDrive, Activity];

/** 监控：本机状态（CPU/内存/磁盘/进程）+ 后端健康。 */
export function Monitor() {
  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-6 py-6">
        <div className="mb-5 flex items-center gap-3">
          <h1 className="text-[18px] font-semibold">监控</h1>
          <span className="rounded-pill border border-line-1 px-2.5 py-1 text-[12px] text-label-2">
            本机状态
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            <i className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" /> 全部正常
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {MONITOR_METRICS.map((m, i) => (
            <MetricCard key={m.label} metric={m} icon={ICON[i]} />
          ))}
        </div>

        <section className="mt-6">
          <p className="mb-2 text-[13px] font-medium">进程</p>
          <div className="overflow-hidden rounded-lg border border-line-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-1 bg-s2 text-label-3">
                  <th className="px-3 py-2 text-left font-medium">进程</th>
                  <th className="px-3 py-2 text-right font-medium">CPU</th>
                  <th className="px-3 py-2 text-right font-medium">内存</th>
                  <th className="px-3 py-2 text-right font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {MONITOR_PROCESSES.map((p) => (
                  <tr key={p.name} className="border-b border-line-1 last:border-0">
                    <td className="px-3 py-2 font-mono text-label-1">{p.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-label-2">{p.cpu.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono text-label-2">{p.mem}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={p.status === "running" ? "text-success" : "text-label-3"}>
                        {p.status === "running" ? "运行中" : "空闲"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "Hermes 后端", value: "healthy", hint: "延迟 12ms" },
            { label: "WS 队列", value: "0", hint: "无积压" },
            { label: "数据库", value: "healthy", hint: "WAL 正常" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-line-1 bg-s1 p-3.5">
              <p className="text-[11px] text-label-3">{c.label}</p>
              <p className="mt-1.5 text-[15px] font-semibold">{c.value}</p>
              <p className="mt-0.5 text-[11px] text-success">{c.hint}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ metric, icon: Icon }: { metric: MonitorMetric; icon: typeof Cpu }) {
  const color =
    metric.health === "ok" ? "bg-success" : metric.health === "warn" ? "bg-warning" : "bg-danger";
  return (
    <div className="rounded-lg border border-line-1 bg-s1 p-3.5">
      <div className="flex items-center gap-1.5 text-label-3">
        <Icon size={14} />
        <span className="text-[11px]">{metric.label}</span>
      </div>
      <p className="mt-2 text-[20px] font-semibold tracking-tight">
        {metric.value}
        <span className="text-[13px] text-label-3">{metric.unit}</span>
      </p>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-s3">
        <span className={cn("block h-full rounded-pill", color)} style={{ width: `${Math.min(metric.value, 100)}%` }} />
      </span>
      <p className="mt-1.5 text-[11px] text-label-3">{metric.detail}</p>
    </div>
  );
}
