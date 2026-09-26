import type { StatusInfo } from "./types";

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return String(value);
}

const PHASE_LABEL: Record<StatusInfo["phase"], string> = {
  thinking: "思考中",
  done: "完成",
  error: "出错",
};

export default function StatusBar({ status }: { status: StatusInfo | null }) {
  if (!status) {
    return null;
  }
  const parts: string[] = [];
  if (status.contextPercent != null) {
    parts.push(`上下文 ${Math.round(status.contextPercent)}%`);
  }
  if (status.tokens != null) {
    parts.push(`${formatTokens(status.tokens)} tok`);
  }
  if (status.tps != null) {
    parts.push(`${Math.round(status.tps)} tok/s`);
  }

  return (
    <div className="status-bar" data-phase={status.phase} role="status">
      {PHASE_LABEL[status.phase]}
      {parts.length > 0 ? ` · ${parts.join(" · ")}` : ""}
      {status.error ? ` · ${status.error}` : ""}
    </div>
  );
}
