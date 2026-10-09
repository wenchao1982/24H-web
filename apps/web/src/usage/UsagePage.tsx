import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Button, EmptyState, Input, Modal, Select, Skeleton } from "../ui";
import {
  normalizeSystemStats,
  normalizeUsage,
  normalizeUsageByModel,
  normalizeUsageSeries,
  type SystemStats,
  type UsageByModel,
  type UsagePoint,
  type UsageSummary,
} from "./analytics";

/** USD→CNY 固定估算汇率（仅前端展示换算）。 */
const USD_TO_CNY = 7.2;

type RangeValue = "1" | "7" | "30" | "custom";
type SortKey = "model" | "tokens" | "messages" | "cost";
type SortDir = "asc" | "desc";
type Currency = "USD" | "CNY";

const RANGES: { value: RangeValue; label: string }[] = [
  { value: "1", label: "今日" },
  { value: "7", label: "近 7 天" },
  { value: "30", label: "近 30 天" },
  { value: "custom", label: "自定义" },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 本地时区 `YYYY-MM-DD`（避免 `toISOString` 的 UTC 偏移）。 */
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatUptime(seconds: number | null): string {
  if (seconds == null) {
    return "—";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} 小时 ${minutes} 分`;
}

/** 健康状态 → 语义色调（ok/success→success，error/异常→danger，其余 neutral）。 */
function healthTone(health: string): "success" | "danger" | "neutral" {
  const value = health.toLowerCase();
  if (/error|down|fail|unhealthy|异常|失败|离线/.test(value)) {
    return "danger";
  }
  if (/ok|healthy|success|up|正常|良好|在线/.test(value)) {
    return "success";
  }
  return "neutral";
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 内联 SVG 令牌趋势图（按 tokens 归一化，简单 polyline + 数据点）。 */
function TokenTrendChart({ points }: { points: UsagePoint[] }) {
  const width = 640;
  const height = 160;
  const padX = 10;
  const padY = 12;
  const max = Math.max(...points.map((point) => point.tokens), 1);
  const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = padX + index * stepX;
    const y = height - padY - (point.tokens / max) * (height - padY * 2);
    return { x, y, point };
  });
  const line = coords.map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(" ");

  return (
    <div className="usage-chart">
      <svg
        role="img"
        aria-label="令牌趋势图"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
      >
        <title>令牌趋势图（{points.length} 个数据点）</title>
        <polyline
          points={line}
          fill="none"
          stroke="var(--ds-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((coord) => (
          <circle
            key={`${coord.point.date}-${coord.x}`}
            cx={coord.x.toFixed(1)}
            cy={coord.y.toFixed(1)}
            r={2}
            fill="var(--ds-accent)"
          />
        ))}
      </svg>
    </div>
  );
}

/** 用量页：时间范围 + 概览 + 趋势 + 系统状态 + 按模型分析（M7 / T10）。 */
export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummary>({
    sessions: 0,
    messages: 0,
    tokens: 0,
    cost: 0,
    inputTokens: null,
    outputTokens: null,
  });
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [models, setModels] = useState<UsageByModel[]>([]);
  const [series, setSeries] = useState<UsagePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<RangeValue>("30");
  const [startDate, setStartDate] = useState(() =>
    toDateInput(new Date(Date.now() - 29 * 86_400_000)),
  );
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [currency, setCurrency] = useState<Currency>("USD");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [detail, setDetail] = useState<UsageByModel | null>(null);

  const customDays = useMemo(() => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return 30;
    }
    return Math.max(1, Math.round((end - start) / 86_400_000));
  }, [startDate, endDate]);

  const days = range === "custom" ? customDays : Number(range);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usagePayload, statsPayload, modelsPayload, statusPayload] = await Promise.all([
        api<unknown>(`/api/hermes/analytics/usage?days=${days}`),
        api<unknown>("/api/hermes/system/stats"),
        api<unknown>(`/api/hermes/analytics/models?days=${days}`),
        // `/system/stats` 无 health → 取 `/status.overall` 补健康/版本。
        api<unknown>("/api/hermes/status").catch(() => null),
      ]);
      const stats = normalizeSystemStats(statsPayload);
      const status = statusPayload ? normalizeSystemStats(statusPayload) : null;
      setUsage(normalizeUsage(usagePayload));
      setSeries(normalizeUsageSeries(usagePayload));
      setStats({
        ...stats,
        health: stats.health || status?.health || "",
        version: stats.version || status?.version || "",
      });
      setModels(normalizeUsageByModel(modelsPayload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载用量统计失败");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  // 同名模型可能多行（不同 profile/时段）→ 聚合为一行。
  const aggregatedModels = useMemo(() => {
    const map = new Map<string, UsageByModel>();
    for (const item of models) {
      const current = map.get(item.model);
      if (!current) {
        map.set(item.model, { ...item });
        continue;
      }
      current.tokens += item.tokens;
      current.cost += item.cost;
      current.messages += item.messages;
      current.cacheRead = (current.cacheRead ?? 0) + (item.cacheRead ?? 0);
    }
    for (const item of map.values()) {
      const cacheRead = item.cacheRead ?? 0;
      item.cacheHitRate =
        item.cacheRead != null && item.tokens + cacheRead > 0
          ? Math.round((cacheRead / (item.tokens + cacheRead)) * 100)
          : item.cacheHitRate;
    }
    return [...map.values()];
  }, [models]);

  const cacheModels = useMemo(
    () => aggregatedModels.filter((item) => item.cacheHitRate != null),
    [aggregatedModels],
  );

  const filteredModels = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const base = keyword
      ? aggregatedModels.filter((item) => item.model.toLowerCase().includes(keyword))
      : aggregatedModels;
    if (!sort) {
      return base;
    }
    const copy = [...base];
    copy.sort((a, b) => {
      let cmp: number;
      if (sort.key === "model") {
        cmp = a.model.localeCompare(b.model);
      } else {
        cmp = a[sort.key] - b[sort.key];
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [aggregatedModels, query, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev && prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (!sort || sort.key !== key) {
      return "none";
    }
    return sort.dir === "asc" ? "ascending" : "descending";
  };

  const exportCsv = () => {
    const header = ["模型", "令牌", "消息", "费用(USD)"];
    const rows = filteredModels.map((item) => [
      item.model,
      String(item.tokens),
      String(item.messages),
      item.cost.toFixed(2),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "usage-models.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="page usage-page">
        <div className="card">
          <Skeleton width="30%" height={22} />
          <Skeleton width="100%" height={96} />
        </div>
        <div className="card">
          <Skeleton width="100%" height={140} />
        </div>
      </div>
    );
  }

  const costValue = currency === "CNY" ? usage.cost * USD_TO_CNY : usage.cost;
  const showTokenSplit = usage.inputTokens != null || usage.outputTokens != null;

  return (
    <div className="page usage-page">
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <div className="usage-toolbar">
        <div className="segmented" role="group" aria-label="时间范围">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              className="segmented-btn"
              data-active={range === option.value}
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {range === "custom" ? (
          <>
            <Input
              type="date"
              aria-label="开始日期"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              type="date"
              aria-label="结束日期"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </>
        ) : null}
        <Select
          aria-label="费用币种"
          value={currency}
          onChange={(event) => setCurrency(event.target.value as Currency)}
        >
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
        </Select>
      </div>

      <div className="card">
        <h3>用量概览（近 {days} 天）</h3>
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
            <span className="metric-label" title="令牌（Token）">
              令牌
            </span>
            <span className="metric-value" aria-label="令牌数" title="令牌（Token）">
              {usage.tokens}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">费用（{currency}）</span>
            <span className="metric-value" aria-label="费用">
              {costValue.toFixed(2)}
            </span>
          </div>
          {showTokenSplit && usage.inputTokens != null ? (
            <div className="metric">
              <span className="metric-label">输入令牌</span>
              <span className="metric-value" aria-label="输入令牌">
                {usage.inputTokens}
              </span>
            </div>
          ) : null}
          {showTokenSplit && usage.outputTokens != null ? (
            <div className="metric">
              <span className="metric-label">输出令牌</span>
              <span className="metric-value" aria-label="输出令牌">
                {usage.outputTokens}
              </span>
            </div>
          ) : null}
          {usage.cacheRead != null ? (
            <div className="metric">
              <span className="metric-label">缓存读取</span>
              <span className="metric-value" aria-label="缓存读取">
                {usage.cacheRead}
              </span>
            </div>
          ) : null}
          {usage.apiCalls != null ? (
            <div className="metric">
              <span className="metric-label">请求数</span>
              <span className="metric-value" aria-label="请求数">
                {usage.apiCalls}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {cacheModels.length > 0 ? (
        <div className="card">
          <h3>缓存命中率（按模型）</h3>
          <div className="cache-bars">
            {cacheModels.map((item) => (
              <div className="cache-bar" key={item.model}>
                <span className="cache-bar-label">{item.model}</span>
                <span className="cache-bar-track">
                  <span
                    className="cache-bar-fill"
                    style={{ width: `${item.cacheHitRate ?? 0}%` }}
                  />
                </span>
                <span className="cache-bar-value">{item.cacheHitRate}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {series.length > 0 ? (
        <div className="card">
          <h3>令牌趋势</h3>
          <TokenTrendChart points={series} />
        </div>
      ) : null}

      {stats ? (
        <div className="card">
          <h3>系统状态</h3>
          <div className="usage-metrics">
            <div className="metric">
              <span className="metric-label">系统健康</span>
              <span
                className="metric-value usage-health"
                data-tone={healthTone(stats.health)}
                aria-label="系统健康"
              >
                {stats.health || "未知"}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">运行时长</span>
              <span className="metric-value" aria-label="运行时长">
                {formatUptime(stats.uptime)}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">CPU</span>
              <span className="metric-value" aria-label="CPU">
                {stats.cpu == null ? "—" : `${stats.cpu}%`}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">内存</span>
              <span className="metric-value" aria-label="内存">
                {stats.memory == null ? "—" : `${stats.memory}%`}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">磁盘</span>
              <span className="metric-value" aria-label="磁盘">
                {stats.disk == null ? "—" : `${stats.disk}%`}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">进程</span>
              <span className="metric-value" aria-label="进程">
                {stats.processes == null ? "—" : stats.processes}
              </span>
            </div>
          </div>
          <p className="usage-note">数据口径：近 {days} 天；令牌为估算用量；费用为估算值</p>
        </div>
      ) : null}

      <div className="card">
        <h3>按模型用量（近 {days} 天）</h3>
        <div className="usage-toolbar">
          <Input
            type="search"
            aria-label="搜索模型"
            placeholder="搜索模型"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button size="sm" variant="ghost" icon="download" aria-label="导出 CSV" onClick={exportCsv}>
            导出 CSV
          </Button>
        </div>
        {filteredModels.length === 0 ? (
          <EmptyState
            icon="info"
            title={models.length === 0 ? "暂无模型用量" : "没有匹配的模型"}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th data-sortable aria-sort={ariaSort("model")}>
                  <button type="button" className="th-sort" onClick={() => toggleSort("model")}>
                    模型
                  </button>
                </th>
                <th data-sortable aria-sort={ariaSort("tokens")}>
                  <button type="button" className="th-sort" onClick={() => toggleSort("tokens")}>
                    令牌
                  </button>
                </th>
                <th data-sortable aria-sort={ariaSort("messages")}>
                  <button type="button" className="th-sort" onClick={() => toggleSort("messages")}>
                    消息
                  </button>
                </th>
                <th>缓存命中</th>
                <th data-sortable aria-sort={ariaSort("cost")}>
                  <button type="button" className="th-sort" onClick={() => toggleSort("cost")}>
                    费用（USD）
                  </button>
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((item) => (
                <tr key={item.model}>
                  <td>{item.model}</td>
                  <td>{item.tokens}</td>
                  <td>{item.messages}</td>
                  <td>{item.cacheHitRate == null ? "—" : `${item.cacheHitRate}%`}</td>
                  <td>{item.cost.toFixed(2)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`查看明细 ${item.model}`}
                      onClick={() => setDetail(item)}
                    >
                      查看明细
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={detail !== null}
        title={detail ? `模型明细：${detail.model}` : undefined}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <table className="table">
            <tbody>
              <tr>
                <th>令牌</th>
                <td>{detail.tokens}</td>
              </tr>
              <tr>
                <th>消息</th>
                <td>{detail.messages}</td>
              </tr>
              <tr>
                <th>费用（USD）</th>
                <td>{detail.cost.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </Modal>
    </div>
  );
}
