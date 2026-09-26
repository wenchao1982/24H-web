import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import {
  normalizeSystemStats,
  normalizeUsage,
  type SystemStats,
  type UsageSummary,
} from "./analytics";

const DAYS = 30;

function formatUptime(seconds: number | null): string {
  if (seconds == null) {
    return "—";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} 小时 ${minutes} 分`;
}

/** 用量页：概览数字 + 系统状态（M7 / T10.1）。 */
export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummary>({
    sessions: 0,
    messages: 0,
    tokens: 0,
    cost: 0,
  });
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usagePayload, statsPayload] = await Promise.all([
        api<unknown>(`/api/hermes/analytics/usage?days=${DAYS}`),
        api<unknown>("/api/hermes/system/stats"),
      ]);
      setUsage(normalizeUsage(usagePayload));
      setStats(normalizeSystemStats(statsPayload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载用量统计失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">加载用量统计中…</p>;
  }

  return (
    <div className="page usage-page">
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <div className="card">
        <h3>用量概览（近 {DAYS} 天）</h3>
        <div className="usage-metrics">
          <div className="metric">
            <span className="metric-label">会话数</span>
            <span className="metric-value" aria-label="会话数">
              {usage.sessions}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">消息数</span>
            <span className="metric-value" aria-label="消息数">
              {usage.messages}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">令牌</span>
            <span className="metric-value" aria-label="令牌数">
              {usage.tokens}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">费用（USD）</span>
            <span className="metric-value" aria-label="费用">
              {usage.cost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {stats ? (
        <div className="card">
          <h3>系统状态</h3>
          <p className="muted" aria-label="系统健康">
            {stats.health || "未知"}
          </p>
          <p className="muted" aria-label="运行时长">
            {formatUptime(stats.uptime)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
