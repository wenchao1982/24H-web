import { useState, type ReactNode } from "react";
import { ArrowUp, Bot, Cpu, FolderClosed, Mic, Paperclip, Plus, SlidersHorizontal } from "lucide-react";
import { cn } from "../lib/cn";
import { Pill } from "./Pill";

export interface ComposerProps {
  variant?: "hero" | "docked";
}

/**
 * hero/docked 双态输入区（Demo）。
 * hero：pill 行在输入框上方、大输入框、居中；
 * docked：贴底常驻（后续接入 transcript 时补 bottom 行）。
 */
export function Composer({ variant = "hero" }: ComposerProps) {
  const hero = variant === "hero";
  const [listening, setListening] = useState(false);
  return (
    <div className={cn("w-full", hero && "mx-auto max-w-[760px]")}>
      {hero ? (
        <div className="mb-2 flex items-center gap-2">
          <Pill icon={Bot}>通用助手</Pill>
          <Pill icon={FolderClosed}>24h-web</Pill>
          <Pill icon={Cpu} badge="Flash">
            DeepSeek Flash
          </Pill>
        </div>
      ) : null}

      {listening ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-accent/30 bg-accent-weak px-3 py-2 text-[12.5px] text-accent">
          <i className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          正在聆听…「帮我把外部 agent 的原生安装方案整理成任务」
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-lg border bg-s1 transition-colors",
          "border-line-1 focus-within:border-accent/40",
          hero
            ? "shadow-[0_1px_2px_rgb(15_17_21_/_4%),0_12px_32px_rgb(15_17_21_/_6%)]"
            : "shadow-[0_-1px_2px_rgb(15_17_21_/_3%)]",
        )}
      >
        <textarea
          rows={hero ? 3 : 2}
          placeholder="问点什么，或输入 / 使用命令…"
          className="thin-scroll block w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] leading-relaxed outline-none placeholder:text-label-3"
        />
        <div className="flex items-center gap-1 px-2.5 pb-2.5">
          <IconBtn label="添加">
            <Plus size={17} />
          </IconBtn>
          <IconBtn label="附件">
            <Paperclip size={16} />
          </IconBtn>
          {!hero ? (
            <IconBtn label="权限模式">
              <SlidersHorizontal size={16} />
            </IconBtn>
          ) : null}
          <span className="flex-1" />
          <span className="mr-1 font-mono text-[11px] text-label-3">0 / 10MB</span>
          <button
            type="button"
            onClick={() => setListening((v) => !v)}
            aria-label={listening ? "停止聆听" : "语音"}
            aria-pressed={listening}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              listening ? "bg-accent-weak text-accent" : "text-label-3 hover:bg-s2 hover:text-label-1",
            )}
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            disabled
            aria-label="发送"
            className="flex h-8 w-8 items-center justify-center rounded-pill bg-accent text-white transition-opacity disabled:opacity-40"
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-label-3 transition-colors hover:bg-s2 hover:text-label-1"
    >
      {children}
    </button>
  );
}
