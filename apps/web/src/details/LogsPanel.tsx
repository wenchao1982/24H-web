import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  Input,
  Select,
  Skeleton,
  Tag,
  type TagTone,
} from "../ui";
import { normalizeLogs, parseLogLine, type LogEntry } from "./logs";

const LEVELS = ["all", "debug", "info", "warn", "error"] as const;
const LEVEL_LABELS: Record<string, string> = {
  all: "全部",
  debug: "调试",
  info: "信息",
  warn: "警告",
  error: "错误",
};

const LEVEL_TONES: Record<string, TagTone> = {
  debug: "neutral",
  info: "info",
  warn: "warning",
  error: "danger",
};

/** 在文本中高亮关键词片段（大小写不敏感）。 */
function highlight(text: string, query: string): ReactNode {
  if (!query) {
    return text;
  }
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let hit = haystack.indexOf(needle, cursor);
  let key = 0;
  while (hit !== -1) {
    if (hit > cursor) {
      parts.push(text.slice(cursor, hit));
    }
    parts.push(<mark key={key++}>{text.slice(hit, hit + needle.length)}</mark>);
    cursor = hit + needle.length;
    hit = haystack.indexOf(needle, cursor);
  }
  parts.push(text.slice(cursor));
  return parts;
}

function firstLine(text: string): string {
  const index = text.indexOf("\n");
  return index === -1 ? text : text.slice(0, index);
}

/** 详情面板 → 任务日志：结构化展示工作区任务运行时日志。 */
export default function LogsPanel() {
  const [level, setLevel] = useState<string>("all");
  const [lines, setLines] = useState("200");
  const [entries, setEntries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
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
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [level, lines],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (paused || !autoScroll) {
      return;
    }
    const timer = setInterval(() => {
      void load(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [paused, autoScroll, load]);

  const parsed = useMemo<LogEntry[]>(
    () => entries.map((line) => parseLogLine(line)),
    [entries],
  );

  const trimmedSearch = search.trim();
  const filtered = useMemo(() => {
    const query = trimmedSearch.toLowerCase();
    if (!query) {
      return parsed;
    }
    return parsed.filter(
      (entry) =>
        entry.raw.toLowerCase().includes(query) ||
        entry.message.toLowerCase().includes(query),
    );
  }, [parsed, trimmedSearch]);

  useEffect(() => {
    if (paused || !autoScroll) {
      return;
    }
    const element = listRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [filtered, paused, autoScroll]);

  const toggleExpand = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const copyLine = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  const exportLogs = () => {
    const content = filtered.map((entry) => entry.raw).join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "task-logs.log";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setEntries([]);
    setExpanded(new Set());
    setConfirmClear(false);
  };

  return (
    <div className="details-logs">
      <p className="muted log-hint">仅展示当前工作区任务运行时原始日志</p>

      <div className="log-toolbar">
        <Select
          aria-label="日志级别"
          className="log-select"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        >
          {LEVELS.map((option) => (
            <option key={option} value={option}>
              {LEVEL_LABELS[option]}
            </option>
          ))}
        </Select>

        <Input
          aria-label="搜索日志"
          className="log-search"
          type="search"
          placeholder="搜索关键词"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <Input
          aria-label="日志行数"
          className="log-lines"
          type="number"
          min={1}
          value={lines}
          onChange={(event) => setLines(event.target.value)}
        />

        <div className="log-action-group">
          <Button
            size="sm"
            variant={autoScroll ? "outline" : "ghost"}
            role="switch"
            aria-label="自动滚动"
            aria-checked={autoScroll}
            onClick={() => setAutoScroll((value) => !value)}
          >
            自动滚动
          </Button>
          <Button
            size="sm"
            variant={paused ? "primary" : "ghost"}
            aria-label={paused ? "继续" : "暂停"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? "继续" : "暂停"}
          </Button>
          <Button size="sm" variant="ghost" aria-label="清空" onClick={() => setConfirmClear(true)}>
            清空
          </Button>
          <Button size="sm" variant="ghost" aria-label="导出" icon="download" onClick={exportLogs}>
            导出
          </Button>
        </div>
      </div>

      {paused ? (
        <button type="button" className="log-banner" onClick={() => setPaused(false)}>
          日志已暂停，点击继续接收
        </button>
      ) : null}

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : loading ? (
        <div className="log-loading" aria-hidden="true">
          <Skeleton width="100%" height={14} />
          <Skeleton width="88%" height={14} />
          <Skeleton width="64%" height={14} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="info" title="暂无日志输出" description="等待系统产生日志" />
      ) : (
        <div className="log-list" role="log" aria-label="日志内容" ref={listRef}>
          {filtered.map((entry, index) => {
            const foldable = /^\s+at /.test(entry.raw) || entry.raw.length > 200;
            const isExpanded = expanded.has(index);
            let shown = entry.message;
            if (foldable && !isExpanded) {
              const first = firstLine(entry.message);
              shown = first.length > 200 ? `${first.slice(0, 200)}…` : first;
            }
            return (
              <div className="log-row" key={`${index}-${entry.raw}`}>
                <div className="log-row-head">
                  <span className="log-time">{entry.time}</span>
                  {entry.level ? (
                    <Tag tone={LEVEL_TONES[entry.level] ?? "neutral"}>
                      {entry.level.toUpperCase()}
                    </Tag>
                  ) : null}
                  {entry.module ? <span className="log-module">{entry.module}</span> : null}
                  <span className="log-row-actions">
                    <button
                      type="button"
                      className="log-action-btn"
                      aria-label="复制"
                      title="复制"
                      onClick={() => copyLine(entry.raw)}
                    >
                      <Icon name="copy" size={14} />
                    </button>
                  </span>
                </div>
                <div className="log-msg">{highlight(shown, trimmedSearch)}</div>
                {foldable ? (
                  <button
                    type="button"
                    className="log-fold"
                    aria-label={isExpanded ? "收起" : "展开"}
                    onClick={() => toggleExpand(index)}
                  >
                    {isExpanded ? "收起" : "展开"}
                  </button>
                ) : null}
                <span className="log-raw" aria-hidden="true">
                  {entry.raw}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="清空日志"
        message="确认清空当前显示的日志？"
        confirmLabel="清空"
        onConfirm={clearLogs}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
