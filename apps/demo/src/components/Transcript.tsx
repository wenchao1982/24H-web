import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  ShieldQuestion,
  Terminal,
  X,
} from "lucide-react";
import type { Message, ServerRequest, ToolCall } from "../mocks/types";
import { cn } from "../lib/cn";

/** transcript：用户/助手气泡 + 思考块 + 工具卡 + 挂起请求卡。 */
export function Transcript({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-5">
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  if (message.request) {
    return <RequestCard request={message.request} />;
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-lg rounded-br-sm bg-accent-weak px-3.5 py-2 text-[13.5px] leading-relaxed text-label-1">
          {message.text}
        </div>
      </div>
    );
  }

  if (message.reasoning) {
    return (
      <div className="flex gap-2.5">
        <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-line-1 bg-s2" />
        <details
          open
          className="group min-w-0 flex-1 rounded-md border border-line-1 bg-s2/60 px-3 py-2"
        >
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] text-label-3">
            <ChevronDown size={13} className="transition-transform group-open:rotate-0 -rotate-90" />
            思考过程
          </summary>
          <p className="mt-1.5 text-[13px] italic leading-relaxed text-label-2">{message.text}</p>
        </details>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
        A
      </span>
      <div className="min-w-0 flex-1">
        {message.text ? (
          <p className="text-[13.5px] leading-relaxed text-label-1">{message.text}</p>
        ) : null}
        {message.tools?.length ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {message.tools.map((tool) => (
              <ToolRow key={tool.id} tool={tool} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const TOOL_META: Record<ToolCall["status"], { label: string; className: string }> = {
  running: { label: "运行中", className: "text-accent" },
  done: { label: "完成", className: "text-success" },
  interrupted: { label: "已中断", className: "text-warning" },
  error: { label: "失败", className: "text-danger" },
};

function ToolRow({ tool }: { tool: ToolCall }) {
  const meta = TOOL_META[tool.status];
  return (
    <div className="flex items-center gap-2 rounded-md border border-line-1 bg-s1 px-2.5 py-1.5 text-[12px]">
      <Terminal size={14} className="shrink-0 text-label-3" />
      <span className="shrink-0 font-mono text-label-1">{tool.name}</span>
      {tool.detail ? <span className="truncate text-label-3">{tool.detail}</span> : null}
      <span className="flex-1" />
      <span className={cn("inline-flex items-center gap-1 font-medium", meta.className)}>
        {tool.status === "running" ? (
          <Loader2 size={12} className="animate-spin" />
        ) : tool.status === "done" ? (
          <Check size={12} />
        ) : tool.status === "error" ? (
          <X size={12} />
        ) : (
          <AlertTriangle size={12} />
        )}
        {meta.label}
      </span>
    </div>
  );
}

function RequestCard({ request }: { request: ServerRequest }) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/[0.06] p-3.5">
      <div className="flex items-center gap-2">
        <ShieldQuestion size={16} className="text-warning" />
        <span className="text-[13px] font-medium text-label-1">{request.title}</span>
        <span className="rounded-pill bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
          等待审批
        </span>
      </div>
      {request.body ? (
        <pre className="mt-2 overflow-x-auto rounded-md border border-line-1 bg-s1 px-3 py-2 font-mono text-[12px] text-label-2">
          {request.body}
        </pre>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {request.options?.map((option, index) => (
          <button
            key={option}
            type="button"
            className={cn(
              "h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors",
              index === 0
                ? "bg-accent text-white hover:bg-accent-strong"
                : index === request.options!.length - 1
                  ? "text-danger hover:bg-s2"
                  : "border border-line-1 text-label-2 hover:bg-s2",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
