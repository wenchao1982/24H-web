import { useState } from "react";
import type { AgentRuntime, UpdateCheck } from "./runtimes";

const TABS = ["概览", "外部会话", "配置"] as const;

export interface RuntimeDetailProps {
  runtime: AgentRuntime;
  autoUpdate: boolean;
  busy?: boolean;
  onInstall: () => Promise<void>;
  onCheckUpdate: () => Promise<UpdateCheck>;
  onRemove: () => Promise<void>;
  onToggleAuto: (enabled: boolean) => Promise<void>;
}

/**
 * 外部 agent 详情（方案 C）：版本 / 检查更新 / 卸载 / 自动更新。
 * 能力（技能/MCP/工具）只作用于 Hermes agent（profile），此处不渲染。
 */
export default function RuntimeDetail({
  runtime,
  autoUpdate,
  busy = false,
  onInstall,
  onCheckUpdate,
  onRemove,
  onToggleAuto,
}: RuntimeDetailProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("概览");
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const guard = async (action: () => Promise<void>) => {
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  };

  return (
    <div className="runtime-detail">
      <header className="agent-detail-head">
        <span className="agent-avatar large" aria-hidden="true">
          {runtime.name.slice(0, 1)}
        </span>
        <div className="agent-detail-title">
          <h2 className="agent-detail-name">{runtime.name}</h2>
          <p className="muted">
            {runtime.vendor} · {runtime.installed ? "Installed" : "未安装"}
            {runtime.version ? ` · v${runtime.version}` : ""}
          </p>
          <p className="muted mono">{runtime.packageName ?? "（无已知安装包）"}</p>
        </div>
        <div className="agent-actions">
          {runtime.installed ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    const result = await onCheckUpdate();
                    setCheck(result);
                  })
                }
              >
                检查更新
              </button>
              <button type="button" disabled={busy} onClick={() => void guard(onRemove)}>
                卸载
              </button>
            </>
          ) : runtime.installable ? (
            <button type="button" disabled={busy} onClick={() => void guard(onInstall)}>
              安装
            </button>
          ) : (
            <button type="button" disabled>
              暂不支持安装
            </button>
          )}
        </div>
      </header>

      {message ? (
        <p className="err" role="alert">
          {message}
        </p>
      ) : null}
      {check ? (
        <p className="muted" role="status">
          {check.updateAvailable
            ? `发现新版本 v${check.latestVersion}（当前 v${check.currentVersion}）`
            : "已是最新版本"}
        </p>
      ) : null}

      <div className="tabs" role="tablist" aria-label="外部 agent">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="tab-panel">
        {tab === "概览" ? (
          <section className="agent-section">
            <label className="runtime-auto">
              <input
                type="checkbox"
                checked={autoUpdate}
                disabled={busy || !runtime.installable}
                aria-label={`自动更新 ${runtime.name}`}
                onChange={(event) => void guard(() => onToggleAuto(event.target.checked))}
              />
              自动更新（空闲时检查并更新；运行中跳过）
            </label>
            <p className="muted tab-note">
              外部 agent 由 BFF 在主安装/管理；技能 / MCP / 工具只在 Hermes agent（profile）生效。
            </p>
          </section>
        ) : tab === "外部会话" ? (
          <p className="empty">外部会话导入见 `session.foreign.*`（此处占位）。</p>
        ) : (
          <p className="empty">该 agent 的配置由自身管理（此处占位）。</p>
        )}
      </div>
    </div>
  );
}
