import { useState } from "react";
import { MessageSquare, Paperclip, Play, Plus, RotateCcw } from "lucide-react";
import { KANBAN_BOARDS, NATIVE_AGENTS } from "../mocks/data";
import type { KanbanCard, KanbanColumn } from "../mocks/types";
import { cn } from "../lib/cn";

const COLUMNS: KanbanColumn[] = [
  "triage",
  "todo",
  "scheduled",
  "ready",
  "running",
  "blocked",
  "review",
  "done",
];
const COLUMN_LABEL: Record<KanbanColumn, string> = {
  triage: "Triage",
  todo: "Todo",
  scheduled: "Scheduled",
  ready: "Ready",
  running: "Running",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};
const RUN_LABEL: Record<NonNullable<KanbanCard["run"]>, { label: string; className: string }> = {
  idle: { label: "空闲", className: "text-label-3" },
  running: { label: "运行中", className: "text-accent" },
  done: { label: "完成", className: "text-success" },
  failed: { label: "失败", className: "text-danger" },
};

/** 看板（Kanban）：固定 4 列 Todo/Doing/Review/Done。 */
export function Kanban() {
  const [boardId, setBoardId] = useState(KANBAN_BOARDS[0].id);
  const board = KANBAN_BOARDS.find((b) => b.id === boardId) ?? KANBAN_BOARDS[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line-1 px-4">
        <h1 className="text-[14px] font-medium">看板</h1>
        <div className="ml-2 flex items-center gap-1">
          {KANBAN_BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBoardId(b.id)}
              className={cn("rounded-md px-3 py-1.5 text-[12.5px] transition-colors", b.id === boardId ? "bg-accent-weak font-medium text-accent" : "text-label-2 hover:bg-s2")}
            >
              {b.name}
            </button>
          ))}
        </div>
        <button type="button" className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-line-1 px-2.5 text-[12px] text-label-2 hover:bg-s2">
          <RotateCcw size={13} /> 回收
        </button>
        <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white hover:bg-accent-strong">
          <Plus size={14} /> 新建任务
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-x-auto">
        <div className="flex h-full min-w-[900px] gap-3 p-4">
          {COLUMNS.map((col) => {
            const cards = board.cards.filter((c) => c.column === col);
            return (
              <section key={col} className="flex min-h-0 w-[280px] shrink-0 flex-col rounded-lg border border-line-1 bg-s2/60">
                <div className="flex h-10 items-center gap-2 px-3">
                  <span className="text-[12.5px] font-semibold">{COLUMN_LABEL[col]}</span>
                  <span className="rounded-pill bg-s3 px-1.5 text-[10px] text-label-3">{cards.length}</span>
                </div>
                <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {cards.map((card) => {
                    const agent = NATIVE_AGENTS.find((a) => a.id === card.assignee);
                    const run = RUN_LABEL[card.run ?? "idle"];
                    return (
                      <article key={card.id} className="rounded-lg border border-line-1 bg-s1 p-3 shadow-[0_1px_2px_rgb(15_17_21_/_4%)]">
                        <p className="text-[13px] font-medium text-label-1">{card.title}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {card.labels.map((l) => (
                            <span key={l} className="rounded-pill bg-s3 px-2 py-0.5 text-[10px] text-label-2">{l}</span>
                          ))}
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-s3 text-[10px] font-semibold text-label-2" title={agent?.name}>
                            {agent?.avatar ?? "?"}
                          </span>
                          <span className={cn("text-[11px]", run.className)}>{run.label}</span>
                          <span className="ml-auto flex items-center gap-2 text-[11px] text-label-3">
                            <span className="inline-flex items-center gap-0.5"><MessageSquare size={11} />{card.comments}</span>
                            <span className="inline-flex items-center gap-0.5"><Paperclip size={11} />{card.attachments}</span>
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          {card.run === "running" ? (
                            <button type="button" className="inline-flex h-6 items-center gap-1 rounded-md border border-line-1 px-2 text-[11px] text-label-2 hover:bg-s2">终止</button>
                          ) : (
                            <button type="button" className="inline-flex h-6 items-center gap-1 rounded-md border border-line-1 px-2 text-[11px] text-label-2 hover:bg-s2">
                              <Play size={11} /> dispatch
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
