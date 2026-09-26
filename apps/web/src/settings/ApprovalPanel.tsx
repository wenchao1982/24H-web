import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeConfig, readPath } from "./config";

export type ApprovalMode = "smart" | "manual" | "off";

const MODES: { value: ApprovalMode; label: string }[] = [
  { value: "smart", label: "智能（smart）" },
  { value: "manual", label: "手动（manual）" },
  { value: "off", label: "关闭（off）" },
];

const MODE_VALUES: ApprovalMode[] = ["smart", "manual", "off"];

function toMode(value: unknown): ApprovalMode {
  return MODE_VALUES.includes(value as ApprovalMode) ? (value as ApprovalMode) : "smart";
}

/** 设置 → 审批策略：读写 `approvals.mode`（smart/manual/off）。 */
export default function ApprovalPanel() {
  const [mode, setMode] = useState<ApprovalMode>("smart");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = normalizeConfig(await api<unknown>("/api/hermes/config"));
      setMode(toMode(readPath(config, "approvals.mode")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载审批策略失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await api("/api/hermes/config", {
        method: "PUT",
        body: JSON.stringify({ approvals: { mode } }),
      });
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存审批策略失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="empty">加载审批策略中…</p>;
  }

  return (
    <div className="settings-section">
      {error ? <p className="err">{error}</p> : null}
      <div className="card">
        <h3>审批策略</h3>
        <div className="row">
          <select
            aria-label="审批模式"
            value={mode}
            onChange={(event) => setMode(toMode(event.target.value))}
          >
            {MODES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
            保存
          </button>
          {saved ? <span className="muted">已保存</span> : null}
        </div>
      </div>
    </div>
  );
}
