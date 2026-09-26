import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeLogs } from "./logs";

const LEVELS = ["all", "debug", "info", "warn", "error"] as const;
const LEVEL_LABELS: Record<string, string> = {
  all: "全部",
  debug: "调试",
  info: "信息",
  warn: "警告",
  error: "错误",
};

/** 详情面板 → 日志：读取并按级别/行数过滤（M7 / T11.2）。 */
export default function LogsPanel() {
  const [level, setLevel] = useState<string>("all");
  const [lines, setLines] = useState("200");
  const [entries, setEntries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (level !== "all") {
        query.set("level", level);
      }
      query.set("lines", lines);
      const payload = await api<unknown>(`/api/hermes/logs?${query.toString()}`);
      setEntries(normalizeLogs(payload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载日志失败");
    } finally {
      setLoading(false);
    }
  }, [level, lines]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="details-logs">
      <div className="details-form">
        <label>
          级别
          <select
            aria-label="日志级别"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            {LEVELS.map((option) => (
              <option key={option} value={option}>
                {LEVEL_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label>
          行数
          <input
            aria-label="日志行数"
            type="number"
            min={1}
            value={lines}
            onChange={(event) => setLines(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="empty">加载日志中…</p>
      ) : entries.length === 0 ? (
        <p className="empty">暂无日志。</p>
      ) : (
        <pre className="log-view" aria-label="日志内容">
          {entries.join("\n")}
        </pre>
      )}
    </div>
  );
}
