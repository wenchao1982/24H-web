import { ArrowDownRight, ArrowUpRight, Clock, Coins, Cpu, PiggyBank, Zap } from "lucide-react";
import { NATIVE_AGENTS, USAGE } from "../mocks/data";
import { cn } from "../lib/cn";

const fmt = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${n}`;

/** 用量：概览 + 缓存命中率 + 按智能体对比 + 按模型费用。 */
export function Usage() {
  const maxTokens = Math.max(...USAGE.byAgent.map((a) => a.tokens));

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-6 py-6">
        <div className="mb-5 flex items-center gap-3">
          <h1 className="text-[18px] font-semibold">用量</h1>
          <span className="rounded-pill border border-line-1 px-2.5 py-1 text-[12px] text-label-2">
            {USAGE.range}
          </span>
          <span className="ml-auto rounded-pill border border-line-1 px-2.5 py-1 text-[12px] text-label-2">
            USD
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Metric icon={Cpu} label="总 Token" value={fmt(USAGE.totalTokens)} delta="+12%" up />
          <Metric icon={Coins} label="真实费用" value={`$${USAGE.totalCostUsd.toFixed(2)}`} delta="+8%" up />
          <Metric icon={PiggyBank} label="缓存节省" value={`$${USAGE.cacheSavedUsd.toFixed(2)}`} delta="-24% cost" />
          <Metric icon={Clock} label="平均延迟" value={`${USAGE.avgLatencyMs}ms`} delta="-5%" />
        </div>

        <section className="mt-6 rounded-lg border border-line-1 bg-s1 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[13px] font-medium">
            <Zap size={14} className="text-label-3" /> 缓存命中率（按模型）
          </p>
          <div className="flex flex-col gap-2.5">
            {USAGE.rows.map((row) => (
              <div key={row.model} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate font-mono text-[12px] text-label-2">{row.model}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-s3">
                  <span className="block h-full rounded-pill bg-accent" style={{ width: `${row.cacheHitRate}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-[12px] text-label-1">{row.cacheHitRate}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-line-1 bg-s1 p-4">
          <p className="mb-3 text-[13px] font-medium">按智能体使用对比</p>
          <div className="flex flex-col gap-2.5">
            {USAGE.byAgent.map((a) => {
              const agent = NATIVE_AGENTS.find((x) => x.id === a.agentId);
              return (
                <div key={a.agentId} className="flex items-center gap-3">
                  <span className="flex w-40 shrink-0 items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-s3 text-[10px] font-semibold text-label-2">
                      {agent?.avatar ?? "?"}
                    </span>
                    <span className="truncate text-[12.5px] text-label-1">{agent?.name ?? a.agentId}</span>
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-s3">
                    <span className="block h-full rounded-pill bg-accent" style={{ width: `${Math.round((a.tokens / maxTokens) * 100)}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-[12px] text-label-2">{fmt(a.tokens)}</span>
                  <span className="w-16 shrink-0 text-right font-mono text-[12px] text-label-1">${a.costUsd.toFixed(2)}</span>
                  <span className="w-14 shrink-0 text-right font-mono text-[11px] text-label-3">{fmt(a.requests)} 次</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <p className="mb-2 text-[13px] font-medium">按模型费用</p>
          <div className="overflow-hidden rounded-lg border border-line-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-1 bg-s2 text-label-3">
                  <th className="px-3 py-2 text-left font-medium">模型</th>
                  <th className="px-3 py-2 text-right font-medium">输入</th>
                  <th className="px-3 py-2 text-right font-medium">输出</th>
                  <th className="px-3 py-2 text-right font-medium">缓存命中</th>
                  <th className="px-3 py-2 text-right font-medium">请求</th>
                  <th className="px-3 py-2 text-right font-medium">真实费用</th>
                </tr>
              </thead>
              <tbody>
                {USAGE.rows.map((row) => (
                  <tr key={row.model} className="border-b border-line-1 last:border-0">
                    <td className="px-3 py-2 font-mono text-label-1">{row.model}</td>
                    <td className="px-3 py-2 text-right font-mono text-label-2">{fmt(row.inputTokens)}</td>
                    <td className="px-3 py-2 text-right font-mono text-label-2">{fmt(row.outputTokens)}</td>
                    <td className="px-3 py-2 text-right font-mono text-success">{row.cacheHitRate}%</td>
                    <td className="px-3 py-2 text-right font-mono text-label-2">{fmt(row.requests)}</td>
                    <td className="px-3 py-2 text-right font-mono text-label-1">${row.costUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-label-3">
            口径：真实费用 = 计费口径扣除缓存折扣后的实际支出；Token 为输入 + 输出之和。
          </p>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  delta,
  up,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  delta: string;
  up?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line-1 bg-s1 p-3.5">
      <div className="flex items-center gap-1.5 text-label-3">
        <Icon size={14} />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-2 text-[20px] font-semibold tracking-tight">{value}</p>
      <p className={cn("mt-1 inline-flex items-center gap-0.5 text-[11px]", up ? "text-success" : "text-label-3")}>
        {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
        {delta}
      </p>
    </div>
  );
}
