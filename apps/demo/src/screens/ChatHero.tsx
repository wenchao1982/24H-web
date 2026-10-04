import { ArrowRight } from "lucide-react";
import { NATIVE_AGENTS, SESSIONS } from "../mocks/data";
import { Composer } from "../components/Composer";
import { Logo } from "../components/Logo";

/** 对话 hero 空态：大标识 + 标题 + 三 pill + 大输入框 + 最近会话。 */
export function ChatHero() {
  const recent = SESSIONS.slice(0, 4);

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-[760px] -translate-y-[4%]">
        {/* 标识 + 标题 */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <h1 className="text-[26px] font-semibold tracking-tight">24H 智能工作台</h1>
            <span className="rounded-pill bg-accent-weak px-2 py-0.5 text-[11px] font-medium text-accent">
              Preview
            </span>
          </div>
          <p className="text-[13px] text-label-3">
            选择智能体与工作区，开始一次对话
          </p>
        </div>

        {/* 输入区 */}
        <Composer variant="hero" />

        {/* 最近会话 */}
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[12px] font-medium text-label-3">最近会话</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] text-label-3 hover:text-label-1"
            >
              全部会话
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recent.map((session) => {
              const agent = NATIVE_AGENTS.find((a) => a.id === session.agentId);
              return (
                <button
                  key={session.id}
                  type="button"
                  className="group flex flex-col gap-1.5 rounded-md border border-line-1 bg-s1 px-3 py-2.5 text-left transition-colors hover:border-line-2 hover:bg-s2"
                >
                  <span className="flex items-center gap-1.5">
                    {session.pending ? (
                      <i className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                    ) : null}
                    <span className="truncate text-[13px] font-medium text-label-1">
                      {session.title}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-label-3">
                    <span>{agent?.name ?? "助手"}</span>
                    <span className="text-line-2">·</span>
                    <span>{session.updatedAt}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
