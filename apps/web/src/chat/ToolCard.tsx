import type { ToolStatus } from "./types";

const STATUS_LABEL: Record<ToolStatus, string> = {
  start: "已开始",
  generating: "生成中",
  complete: "完成",
};

export interface ToolCardProps {
  name: string;
  status: ToolStatus;
  detail?: string;
  result?: string;
}

export default function ToolCard({ name, status, detail, result }: ToolCardProps) {
  return (
    <details className="tool-card" data-status={status} open={status !== "complete"}>
      <summary className="tool-summary">
        <span className="tool-name">{name}</span>
        <span className="tool-status" data-status={status}>
          {STATUS_LABEL[status]}
        </span>
      </summary>
      {detail ? <pre className="tool-detail">{detail}</pre> : null}
      {result ? <pre className="tool-result">{result}</pre> : null}
    </details>
  );
}
