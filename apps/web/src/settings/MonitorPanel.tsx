import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeSystemStats, type SystemStats } from "../usage/analytics";

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

/** 设置 → 监控：CPU/内存/磁盘/进程 + 健康（M7 / T10.3）。 */
export default function MonitorPanel() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [status, setStatus] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsPayload, statusPayload] = await Promise.all([
        api<unknown>("/api/hermes/system/stats"),
        api<unknown>("/api/hermes/status"),
      ]);
      setStats(normalizeSystemStats(statsPayload));
      setStatus(normalizeSystemStats(statusPayload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载系统监控失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">加载系统监控中…</p>;
  }

  const health = status?.health || stats?.health || "未知";
  const version = status?.version || stats?.version || "";

  return (
    <div className="settings-section">
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <div className="card">
        <h3>系统监控</h3>
        <div className="usage-metrics">
          <div className="metric">
            <span className="metric-label">CPU 使用率</span>
            <span className="metric-value" aria-label="CPU 使用率">
              {formatPercent(stats?.cpu ?? null)}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">内存使用率</span>
            <span className="metric-value" aria-label="内存使用率">
              {formatPercent(stats?.memory ?? null)}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">磁盘使用率</span>
            <span className="metric-value" aria-label="磁盘使用率">
              {formatPercent(stats?.disk ?? null)}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">进程数</span>
            <span className="metric-value" aria-label="进程数">
              {stats?.processes ?? "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>健康</h3>
        <p className="muted" aria-label="监控健康">
          {health}
        </p>
        {version ? (
          <p className="muted" aria-label="版本">
            {version}
          </p>
        ) : null}
      </div>
    </div>
  );
}
