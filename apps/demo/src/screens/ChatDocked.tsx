import { ChevronLeft, MoreHorizontal, PanelRight, Square } from "lucide-react";
import { MESSAGES } from "../mocks/data";
import { Composer } from "../components/Composer";
import { Transcript } from "../components/Transcript";

/** 对话 docked：会话头 + transcript + 贴底常驻输入框。 */
export function ChatDocked() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 会话头 */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line-1 px-4">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md text-label-3 hover:bg-s2 hover:text-label-1"
          aria-label="返回"
        >
          <ChevronLeft size={16} />
        </button>
        <h1 className="truncate text-[14px] font-medium">重构对话输入区 hero/docked</h1>
        <span className="shrink-0 rounded-pill border border-line-1 px-2 py-0.5 text-[11px] text-label-3">
          通用助手
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span className="mr-1 inline-flex items-center gap-1.5 rounded-pill border border-line-1 px-2.5 py-1 text-[12px] text-label-2">
            <i className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            deepseek-flash
          </span>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-label-2 hover:bg-s2"
            aria-label="停止"
          >
            <Square size={14} />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-label-2 hover:bg-s2"
            aria-label="更多"
          >
            <MoreHorizontal size={16} />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-label-2 hover:bg-s2"
            aria-label="详情面板"
          >
            <PanelRight size={16} />
          </button>
        </span>
      </header>

      {/* transcript */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[820px] px-6 py-6">
          <Transcript messages={MESSAGES} />
        </div>
      </div>

      {/* 贴底输入框 */}
      <div className="shrink-0 border-t border-line-1 px-6 py-3">
        <div className="mx-auto max-w-[820px]">
          <Composer variant="docked" />
        </div>
      </div>
    </div>
  );
}
