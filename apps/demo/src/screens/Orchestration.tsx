import { Download, Play, Upload } from "lucide-react";
import { FLOW_EDGES, FLOW_NODES } from "../mocks/data";
import { cn } from "../lib/cn";

/** 可视化编排：画布（节点=agent/判定/工具，边=委托 + 上游输出注入下游 {{node.output}}）。 */
export function Orchestration() {
  const nodeById = (id: string) => FLOW_NODES.find((n) => n.id === id)!;

  return (
    <div className="flex h-full min-h-0">
      {/* 画布 */}
      <div className="thin-scroll min-w-0 flex-1 overflow-auto bg-s2 p-6">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-[14px] font-medium">编排</h1>
          <span className="rounded-pill border border-line-1 px-2 py-0.5 text-[11px] text-label-3">变量注入</span>
          <span className="font-mono text-[11px] text-accent">{"{{node.output}}"}</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border border-line-1 px-2.5 text-[12px] text-label-2 hover:bg-s1">
              <Upload size={13} /> 导入
            </button>
            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border border-line-1 px-2.5 text-[12px] text-label-2 hover:bg-s1">
              <Download size={13} /> 导出
            </button>
            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white hover:bg-accent-strong">
              <Play size={13} /> 运行
            </button>
          </div>
        </div>

        <div className="relative h-[420px] w-[720px] rounded-lg border border-line-1 bg-s1">
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {FLOW_EDGES.map((e) => {
              const a = nodeById(e.from);
              const b = nodeById(e.to);
              const x1 = a.x + 110;
              const y1 = a.y + 22;
              const x2 = b.x;
              const y2 = b.y + 22;
              return (
                <g key={`${e.from}-${e.to}`}>
                  <path d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} fill="none" stroke="var(--ds-border-l2)" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  {e.inject ? (
                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" className="fill-accent font-mono" fontSize="10">
                      {"{{node.output}}"}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--ds-border-l2)" />
              </marker>
            </defs>
          </svg>

          {FLOW_NODES.map((n) => (
            <div
              key={n.id}
              style={{ left: n.x, top: n.y }}
              className={cn(
                "absolute w-[140px] rounded-lg border bg-s1 px-3 py-2 shadow-[0_1px_2px_rgb(15_17_21_/_6%)]",
                n.kind === "decision" ? "border-warning/50" : n.kind === "tool" ? "border-success/40" : "border-accent/40",
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-label-3">{n.kind === "agent" ? "agent" : n.kind === "decision" ? "判定" : "工具"}</p>
              <p className="text-[12.5px] font-medium text-label-1">{n.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 运行面板 */}
      <div className="flex w-[340px] shrink-0 flex-col border-l border-line-1">
        <div className="flex h-12 items-center gap-2 border-b border-line-1 px-4">
          <h2 className="text-[13px] font-medium">运行视图</h2>
          <span className="inline-flex items-center gap-1 text-[11px] text-accent">
            <i className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" /> 运行中
          </span>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-label-3">子代理树</p>
          <div className="flex flex-col gap-1.5">
            {[
              { name: "研究员", depth: 0, status: "完成" },
              { name: "编码", depth: 1, status: "运行中" },
              { name: "评审", depth: 1, status: "等待" },
            ].map((s) => (
              <div
                key={s.name}
                style={{ paddingLeft: s.depth * 14 }}
                className="flex items-center gap-2 rounded-md border border-line-1 bg-s1 px-3 py-2 text-[12px]"
              >
                <i className={cn("h-1.5 w-1.5 rounded-full", s.status === "运行中" ? "bg-accent" : s.status === "完成" ? "bg-success" : "bg-label-3")} aria-hidden="true" />
                <span className="text-label-1">{s.name}</span>
                <span className="ml-auto text-[11px] text-label-3">{s.status}</span>
              </div>
            ))}
          </div>
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-label-3">事件</p>
          <div className="flex flex-col gap-1 font-mono text-[11px] text-label-2">
            <p>subagent.start 编码</p>
            <p>subagent.thinking 评审</p>
            <p className="text-label-3">delegation.status ready</p>
          </div>
        </div>
      </div>
    </div>
  );
}
