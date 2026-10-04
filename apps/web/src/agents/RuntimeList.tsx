import type { AgentRuntime } from "./runtimes";

export interface RuntimeListProps {
  runtimes: AgentRuntime[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/**
 * 智能体页「外部 agent」分组（方案 C）：列出 BFF 登记的外部运行时（Claude Code / Codex / …）。
 * 与 Hermes（profile）分组并列；选中的详情由 `RuntimeDetail` 呈现。
 */
export default function RuntimeList({ runtimes, activeId, onSelect }: RuntimeListProps) {
  return (
    <section className="runtime-group" aria-label="外部 agent">
      <p className="runtime-group-title">外部 agent</p>
      {runtimes.length === 0 ? (
        <p className="muted runtime-empty">暂无外部 agent（可在服务器经 BFF 安装）。</p>
      ) : (
        <ul className="runtime-items">
          {runtimes.map((runtime) => (
            <li key={runtime.id}>
              <button
                type="button"
                className="runtime-item"
                data-active={runtime.id === activeId}
                aria-current={runtime.id === activeId ? "true" : undefined}
                onClick={() => onSelect(runtime.id)}
              >
                <span className="runtime-item-name">{runtime.name}</span>
                <span className="runtime-item-meta">
                  <i className="dot" data-on={runtime.installed} aria-hidden="true" />
                  {runtime.installed ? runtime.version ?? "已安装" : "未安装"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
