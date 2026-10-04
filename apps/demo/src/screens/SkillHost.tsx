import { useState } from "react";
import { Monitor, RotateCw, Smartphone, Tablet, Terminal } from "lucide-react";
import { SANDBOX_SKILLS } from "../mocks/data";
import { cn } from "../lib/cn";

const SIZES = [
  { id: "desktop", label: "桌面", icon: Monitor, width: 720 },
  { id: "tablet", label: "平板", icon: Tablet, width: 520 },
  { id: "phone", label: "手机", icon: Smartphone, width: 360 },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

/** 技能界面：技能选择 + 沙箱预览 + 状态/日志。 */
export function SkillHost() {
  const [skillId, setSkillId] = useState(SANDBOX_SKILLS[0].id);
  const [size, setSize] = useState<SizeId>("desktop");
  const [showLog, setShowLog] = useState(false);
  const skill = SANDBOX_SKILLS.find((s) => s.id === skillId) ?? SANDBOX_SKILLS[0];
  const width = SIZES.find((s) => s.id === size)!.width;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line-1 px-4">
        <h1 className="text-[14px] font-medium">技能界面</h1>
        <select
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          className="h-8 rounded-md border border-line-1 bg-s1 px-2 text-[12.5px] text-label-1 outline-none"
        >
          {SANDBOX_SKILLS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.description}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 px-2.5 text-[12.5px] text-label-2 hover:bg-s2"
        >
          <RotateCw size={14} /> 重新加载
        </button>
        <span className="ml-auto flex items-center gap-1 text-label-3">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSize(s.id)}
              aria-label={s.label}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                size === s.id ? "bg-accent-weak text-accent" : "hover:bg-s2",
              )}
            >
              <s.icon size={15} />
            </button>
          ))}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
          <i className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" /> 就绪
        </span>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto bg-s2 p-6">
        <div className="mx-auto" style={{ width, maxWidth: "100%" }}>
          <div className="overflow-hidden rounded-lg border border-line-1 bg-s1 shadow-[0_8px_24px_rgb(15_17_21_/_8%)]">
            <div className="flex h-8 items-center gap-1.5 border-b border-line-1 bg-s2 px-3">
              <i className="h-2.5 w-2.5 rounded-full bg-danger/60" />
              <i className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <i className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <span className="ml-2 font-mono text-[11px] text-label-3">
                {skill.id} · sandbox
              </span>
            </div>
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-weak text-accent">
                <Terminal size={22} />
              </span>
              <h2 className="text-[16px] font-semibold">{skill.name}</h2>
              <p className="max-w-[320px] text-[12.5px] text-label-3">{skill.description}</p>
              <div className="mt-1 grid w-full max-w-[360px] grid-cols-2 gap-2">
                <div className="rounded-md border border-line-1 bg-s2 px-3 py-2 text-left">
                  <p className="text-[10px] text-label-3">调用次数</p>
                  <p className="text-[15px] font-semibold">128</p>
                </div>
                <div className="rounded-md border border-line-1 bg-s2 px-3 py-2 text-left">
                  <p className="text-[10px] text-label-3">平均耗时</p>
                  <p className="text-[15px] font-semibold">840ms</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-label-3">
            沙箱内运行第三方技能 UI，能力通过 broker 代理，不直接访问宿主。
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-line-1">
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="flex w-full h-9 items-center gap-2 px-4 text-[12px] text-label-3 hover:text-label-1"
        >
          <Terminal size={13} /> 通信日志
          <span className="text-label-3">{showLog ? "▾" : "▸"}</span>
        </button>
        {showLog ? (
          <div className="thin-scroll max-h-32 overflow-y-auto border-t border-line-1 bg-s2 px-4 py-2 font-mono text-[11px] leading-relaxed text-label-2">
            <p>→ host.init {"{ theme: \"light\" }"} </p>
            <p>← ready</p>
            <p>→ rpc /api/skill-host/invoke {"{ tool: \"summary\" }"}</p>
            <p>← ok (842ms)</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
