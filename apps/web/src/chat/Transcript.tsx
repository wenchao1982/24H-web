import ToolCard from "./ToolCard";
import type { TranscriptItem } from "./types";

export default function Transcript({ items }: { items: TranscriptItem[] }) {
  if (items.length === 0) {
    return <p className="empty transcript-empty">还没有消息。</p>;
  }

  return (
    <div className="transcript" role="log" aria-label="对话记录">
      {items.map((item) => {
        if (item.kind === "message") {
          return (
            <div
              key={item.id}
              className="bubble"
              data-role={item.role}
              data-streaming={item.streaming}
              data-reasoning={item.reasoning ? "true" : undefined}
            >
              {item.reasoning ? <span className="bubble-label">思考过程</span> : null}
              {item.text}
            </div>
          );
        }
        if (item.kind === "tool") {
          return (
            <ToolCard
              key={item.id}
              name={item.name}
              status={item.status}
              detail={item.detail}
              result={item.result}
            />
          );
        }
        return (
          <p key={item.id} className="notice" data-level={item.level}>
            {item.text}
          </p>
        );
      })}
    </div>
  );
}
