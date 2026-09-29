import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGateway } from "./GatewayProvider";
import { api } from "../api/client";
import { isSessionNotFound } from "../api/ws";
import { useMediaQuery } from "../shell/useMediaQuery";
import { useDetails } from "../shell/details-context";
import { Icon } from "../ui/icons";
import { Button, EmptyState } from "../ui";
import { t } from "../i18n";
import SessionList from "./SessionList";
import Transcript from "./Transcript";
import Composer from "./Composer";
import StatusBar from "./StatusBar";
import ServerRequestCard from "./ServerRequestCard";
import SubagentsPanel from "./SubagentsPanel";
import ImageGenAction from "./ImageGenAction";
import CommandPanel from "./CommandPanel";
import ContextFilesPanel from "./ContextFilesPanel";
import PersonalityPanel from "./PersonalityPanel";
import {
  normalizeCatalog,
  normalizeCompletions,
  slashResultText,
  type SlashCommand,
} from "./slash";
import {
  appendDelta,
  appendInterruptedNotice,
  completeAssistant,
  deltaText,
  errorText,
  isReasoningOnly,
  matchesRuntime,
  normalizeCreatedIdentity,
  normalizeHistoryMessages,
  normalizeReplayed,
  normalizeResumedId,
  normalizeSessions,
  normalizeWorkspaces,
  parseStatus,
  settleTools,
  toolDetail,
  toolId,
  toolName,
  toolResult,
  turnStatus,
  upsertTool,
  type Attachment,
  type PendingRequest,
  type RequestKind,
  type SessionIdentity,
  type SessionSummary,
  type StatusInfo,
  type TranscriptItem,
} from "./types";

const REQUEST_KINDS: RequestKind[] = ["approval", "clarify", "sudo", "secret", "mcp.setup"];

type ResolvedSession = { runtimeId: string; items: TranscriptItem[] };

/** 读取本地文件文本（用于导入会话）。 */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取失败"));
    reader.readAsText(file);
  });
}

export default function ChatPage() {
  const gateway = useGateway();
  const details = useDetails();
  const narrow = useMediaQuery("(max-width: 900px)");
  const [view, setView] = useState<"list" | "chat">("list");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchResults, setSearchResults] = useState<SessionSummary[] | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [subagentsOpen, setSubagentsOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [commands, setCommands] = useState<SlashCommand[]>([]);

  const activeIdRef = useRef<string | null>(null);
  const identityRef = useRef<SessionIdentity | null>(null);
  const attachInFlightRef = useRef<Map<string, Promise<ResolvedSession>>>(new Map());
  const respondersRef = useRef(new Map<string, (result: Record<string, unknown>) => void>());
  const seqRef = useRef(0);
  const nextId = useCallback(() => `i${seqRef.current++}`, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // 窄屏：选中会话后切到 transcript 视图。
  useEffect(() => {
    if (narrow && activeId) {
      setView("chat");
    }
  }, [narrow, activeId]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        await gateway.connect();
      } catch {
        // 连接失败仍尝试调用（可能此前已连接）
      }
      try {
        const result = await gateway.request("session.list", {});
        if (alive) {
          setSessions(normalizeSessions(result));
        }
      } catch {
        if (alive) {
          setError("无法加载会话列表");
        }
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [gateway]);

  // T20.1 命令目录：优先 `commands.catalog`，为空时回退 `complete.slash`。
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        await gateway.connect().catch(() => undefined);
        const catalog = normalizeCatalog(await gateway.request("commands.catalog", {}));
        if (catalog.length > 0) {
          if (alive) {
            setCommands(catalog);
          }
          return;
        }
        const completions = normalizeCompletions(
          await gateway.request("complete.slash", { prefix: "/" }),
        );
        if (alive) {
          setCommands(completions);
        }
      } catch {
        // 命令目录不可用时静默降级（输入框仍可发送普通消息）
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [gateway]);

  const activePair = useCallback((): SessionIdentity | null => {
    const pair = identityRef.current;
    return pair && pair.storedId === activeIdRef.current ? pair : null;
  }, []);

  useEffect(() => {
    const unsubscribes = [
    gateway.on("message.delta", (payload) => {
      const pair = activePair();
      if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
        return;
      }
      const text = deltaText(payload);
      if (text) {
        setItems((current) => appendDelta(current, text, nextId()));
      }
    }),
    gateway.on("message.complete", (payload) => {
      const pair = activePair();
      if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
        return;
      }
      const outcome = turnStatus(payload);
      setItems((current) => {
        const sealed = completeAssistant(
          current,
          deltaText(payload),
          nextId(),
          isReasoningOnly(payload),
        );
        if (outcome === "complete") {
          return sealed;
        }
        const settled = settleTools(sealed, outcome === "error" ? "complete" : "interrupted");
        return outcome === "interrupted"
          ? appendInterruptedNotice(settled, nextId())
          : settled;
      });
      setRunning(false);
      if (outcome === "interrupted") {
        setStatus({ phase: "interrupted" });
      } else if (outcome === "error") {
        setStatus({ phase: "error", error: errorText(payload) });
      } else {
        setStatus({ phase: "done" });
      }
    }),
    gateway.on("tool.start", (payload) => {
      const pair = activePair();
      if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
        return;
      }
      setItems((current) =>
        upsertTool(current, toolId(payload), toolName(payload), "start", {
          detail: toolDetail(payload),
        }),
      );
    }),
    gateway.on("tool.generating", (payload) => {
      const pair = activePair();
      if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
        return;
      }
      setItems((current) =>
        upsertTool(current, toolId(payload), toolName(payload), "generating", {
          detail: toolDetail(payload),
        }),
      );
    }),
    gateway.on("tool.complete", (payload) => {
      const pair = activePair();
      if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
        return;
      }
      setItems((current) =>
        upsertTool(current, toolId(payload), toolName(payload), "complete", {
          result: toolResult(payload),
        }),
      );
    }),
    gateway.on("thinking", (payload) => {
      const pair = activePair();
      if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
        return;
      }
      setStatus({ phase: "thinking", ...parseStatus(payload) });
    }),
    gateway.on("done", (payload) => {
      const pair = activePair();
      const hasId = payload.session_id != null || payload.sessionId != null;
      if (hasId && (!pair || !matchesRuntime(payload, pair.runtimeId))) {
        return;
      }
      setRunning(false);
      setStatus({ phase: "done" });
    }),
    gateway.on("error", (payload) => {
      const pair = activePair();
      const hasId = payload.session_id != null || payload.sessionId != null;
      if (hasId && (!pair || !matchesRuntime(payload, pair.runtimeId))) {
        return;
      }
      setRunning(false);
      setStatus({ phase: "error", error: errorText(payload) });
      if (hasId) {
        setItems((current) => [
          ...current,
          { kind: "notice", id: nextId(), level: "error", text: errorText(payload) },
        ]);
      }
    }),
    ];
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [activePair, gateway, nextId]);

  useEffect(() => {
    const unsubscribes = REQUEST_KINDS.map((kind) =>
      gateway.onServerRequest(kind, (params, respond) => {
        const id = nextId();
        respondersRef.current.set(id, respond);
        setPending((current) => [...current, { id, kind, params }]);
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [gateway, nextId]);

  // 断线重放：切换会话时拉取待处理服务端请求快照，重新渲染卡片。
  useEffect(() => {
    if (!identity || identity.storedId !== activeId) {
      return;
    }
    let alive = true;
    gateway
      .request("session.events.since", { session_id: identity.runtimeId })
      .then((result) => {
        if (!alive) {
          return;
        }
        const replayed = normalizeReplayed(result);
        if (replayed.length === 0) {
          return;
        }
        setPending((current) => {
          const ids = new Set(current.map((entry) => entry.id));
          return [...current, ...replayed.filter((entry) => !ids.has(entry.id))];
        });
      })
      .catch(() => {
        // 重放失败不阻断对话
      });
    return () => {
      alive = false;
    };
  }, [identity?.runtimeId, activeId, gateway]);

  const resumeSession = useCallback(
    async (storedId: string): Promise<ResolvedSession> => {
      const inflight = attachInFlightRef.current.get(storedId);
      if (inflight) {
        return inflight;
      }
      const promise = (async (): Promise<ResolvedSession> => {
        const result = await gateway.request("session.resume", { session_id: storedId });
        const runtimeId = normalizeResumedId(result);
        if (!runtimeId) {
          throw new Error("会话恢复失败：响应缺少 session_id");
        }
        return { runtimeId, items: normalizeHistoryMessages(result) };
      })();
      attachInFlightRef.current.set(storedId, promise);
      try {
        return await promise;
      } finally {
        attachInFlightRef.current.delete(storedId);
      }
    },
    [gateway],
  );

  const attachSession = useCallback(
    async (storedId: string, applyHistory = false): Promise<SessionIdentity> => {
      const { runtimeId, items } = await resumeSession(storedId);
      const pair: SessionIdentity = { storedId, runtimeId };
      if (activeIdRef.current === storedId) {
        setIdentity(pair);
        identityRef.current = pair;
        if (applyHistory) {
          setItems(items);
        }
      }
      return pair;
    },
    [resumeSession],
  );

  const selectSession = useCallback(
    (id: string) => {
      setActiveId(id);
      activeIdRef.current = id;
      setItems([]);
      setIdentity(null);
      identityRef.current = null;
      attachSession(id, true).catch(() => {
        if (activeIdRef.current === id) {
          setError("无法恢复会话");
        }
      });
    },
    [attachSession],
  );

  const createSession = useCallback(async () => {
    try {
      const ids = normalizeCreatedIdentity(await gateway.request("session.create", {}));
      if (!ids) {
        setError("无法新建会话");
        return;
      }
      setActiveId(ids.storedId);
      activeIdRef.current = ids.storedId;
      setIdentity(ids);
      identityRef.current = ids;
      setSessions((current) =>
        current.some((session) => session.id === ids.storedId)
          ? current
          : [{ id: ids.storedId, title: "新会话" }, ...current],
      );
      setItems([]);
    } catch {
      setError("无法新建会话");
    }
  }, [gateway]);

  const renameSession = useCallback(
    async (targetStoredId: string, title: string) => {
      try {
        const active = activePair();
        const runtimeId =
          active && active.storedId === targetStoredId
            ? active.runtimeId
            : (await resumeSession(targetStoredId)).runtimeId;
        await gateway.request("session.title", { session_id: runtimeId, title });
        setSessions((current) =>
          current.map((session) =>
            session.id === targetStoredId ? { ...session, title } : session,
          ),
        );
      } catch {
        setError("重命名失败");
      }
    },
    [activePair, gateway, resumeSession],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await gateway.request("session.delete", { session_id: id });
        setSessions((current) => current.filter((session) => session.id !== id));
        setActiveId((current) => (current === id ? null : current));
      } catch {
        setError("删除失败");
      }
    },
    [gateway],
  );

  const linkedRef = useRef(false);
  // 通知中心直达：`/chat?session=<id>` 选中该会话（仅一次，等价点选路径）。
  useEffect(() => {
    if (linkedRef.current || sessions.length === 0 || typeof window === "undefined") {
      return;
    }
    const target = new URLSearchParams(window.location.search).get("session");
    if (target && sessions.some((session) => session.id === target)) {
      linkedRef.current = true;
      selectSession(target);
    }
  }, [selectSession, sessions]);

  const pruneSessions = useCallback(async () => {
    try {
      await api("/api/hermes/sessions/prune", { method: "POST", body: JSON.stringify({}) });
      const result = await gateway.request("session.list", {});
      setSessions(normalizeSessions(result));
    } catch {
      setError("清理失败");
    }
  }, [gateway]);

  const bulkDeleteSessions = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }
    try {
      await api("/api/hermes/sessions/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      setSessions((current) => current.filter((session) => !ids.includes(session.id)));
      setActiveId((current) => (current && ids.includes(current) ? null : current));
    } catch {
      setError("批量删除失败");
    }
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      const storedId = activeIdRef.current;
      if (!storedId) {
        return;
      }
      setItems((current) => [
        ...current,
        { kind: "message", id: nextId(), role: "user", text },
      ]);
      setRunning(true);
      setStatus({ phase: "thinking" });
      const base: Record<string, unknown> = { text };
      if (attachments.length > 0) {
        base.attachments = attachments.map((attachment) => attachment.id);
      }
      setAttachments([]);
      const msg = (error: unknown) => String((error as Error)?.message ?? "发送失败");
      void (async () => {
        let pair = activePair();
        if (!pair) {
          try {
            pair = await attachSession(storedId);
          } catch {
            setRunning(false);
            setError("无法恢复会话");
            return;
          }
        }
        if (activeIdRef.current !== storedId) {
          setRunning(false);
          return;
        }
        try {
          await gateway.request("prompt.submit", { ...base, session_id: pair.runtimeId });
        } catch (error) {
          if (!isSessionNotFound(error)) {
            setRunning(false);
            setError(msg(error));
            return;
          }
          const next = await attachSession(storedId).catch(() => null);
          if (next && activeIdRef.current === storedId) {
            try {
              await gateway.request("prompt.submit", { ...base, session_id: next.runtimeId });
              return;
            } catch (retryError) {
              setRunning(false);
              setError(msg(retryError));
              return;
            }
          }
          setRunning(false);
          if (activeIdRef.current !== storedId) {
            return;
          }
          setError(msg(error));
        }
      })();
    },
    [activePair, attachSession, attachments, gateway, nextId],
  );

  const handleStop = useCallback(() => {
    const pair = activePair();
    if (!pair) {
      return;
    }
    gateway
      .request("session.interrupt", { session_id: pair.runtimeId })
      .then((result) => {
        // 回包 {status:"interrupted"|"not_interrupted"}：not_interrupted 表示会话已不在运行，静默即可。
        void result;
      })
      .catch(() => {
        setError("无法中断");
      })
      .finally(() => setRunning(false));
  }, [activePair, gateway]);

  // T20.1 执行 slash 命令：`slash.exec {command, args}`，结果作为完成提示追加到 transcript。
  const handleSlash = useCallback(
    (command: string, args: string) => {
      const label = args ? `/${command} ${args}` : `/${command}`;
      setItems((current) => [
        ...current,
        { kind: "message", id: nextId(), role: "user", text: label },
      ]);
      setError(null);
      gateway
        .request("slash.exec", { command: `/${command}`, args })
        .then((result) => {
          const text = slashResultText(result) || t("slash.done", { command: `/${command}` });
          setItems((current) => [
            ...current,
            { kind: "notice", id: nextId(), level: "done", text },
          ]);
        })
        .catch(() => setError(t("slash.error")));
    },
    [gateway, nextId],
  );

  const handleAttach = useCallback(
    (files: File[]) => {
      const runtimeId = activePair()?.runtimeId;
      if (!runtimeId) {
        setError("会话未就绪，无法添加附件");
        return;
      }
      for (const file of files) {
        const method: Attachment["method"] = file.type.startsWith("image/")
          ? "image.attach"
          : file.type === "application/pdf"
            ? "pdf.attach"
            : "file.attach";
        const id = nextId();
        setAttachments((current) => [
          ...current,
          { id, name: file.name, size: file.size, type: file.type, method },
        ]);
        gateway
          .request(method, {
            session_id: runtimeId,
            name: file.name,
            size: file.size,
            type: file.type,
          })
          .catch(() => setError("附件上传失败"));
      }
    },
    [activePair, gateway, nextId],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }, []);

  const exportSession = useCallback(async () => {
    const sessionId = activeIdRef.current;
    if (!sessionId) {
      return;
    }
    try {
      await api("/api/hermes/sessions/export", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      setError("导出失败");
    }
  }, []);

  const importSession = useCallback(
    async (file: File) => {
      try {
        const text = await readFileText(file);
        await api("/api/hermes/sessions/import", { method: "POST", body: text });
        const result = await gateway.request("session.list", {});
        setSessions(normalizeSessions(result));
      } catch {
        setError("导入失败");
      }
    },
    [gateway],
  );

  const shareSession = useCallback(async () => {
    const sessionId = activeIdRef.current;
    if (!sessionId) {
      return;
    }
    const link = `${location.origin}${location.pathname}?session=${encodeURIComponent(sessionId)}`;
    try {
      await navigator.clipboard?.writeText(link);
    } catch {
      // 剪贴板不可用时仅展示链接
    }
    setShareLink(link);
  }, []);

  const handleWorkspaceChange = useCallback(
    (value: string) => {
      setWorkspace(value);
      const storedId = activeIdRef.current;
      if (!storedId || !value) {
        return;
      }
      gateway
        .request("session.workspace.move", { session_key: storedId, cwd: value })
        .catch(() => setError("切换工作区失败"));
    },
    [gateway],
  );

  const answerRequest = useCallback(
    (requestId: string, result: Record<string, unknown>) => {
      const respond = respondersRef.current.get(requestId);
      respond?.(result);
      respondersRef.current.delete(requestId);
      const value = result.choice ?? result.answer ?? result.value;
      const label = typeof value === "string" ? value : "已提交";
      setPending((current) =>
        current.map((entry) =>
          entry.id === requestId ? { ...entry, answered: true, answer: label } : entry,
        ),
      );
    },
    [],
  );

  // 会话搜索：防抖后走 L1 `session.list {q}`（BFF→L1/L2）。
  useEffect(() => {
    const query = filter.trim();
    if (query === "") {
      setSearchResults(null);
      return;
    }
    const handle = setTimeout(() => {
      gateway
        .request("session.list", { q: query })
        .then((result) => setSearchResults(normalizeSessions(result)))
        .catch(() => setSearchResults(null));
    }, 250);
    return () => clearTimeout(handle);
  }, [filter, gateway]);

  // 工作区列表：切换会话时刷新。
  useEffect(() => {
    let alive = true;
    api<unknown>("/api/hermes/chat/workspaces")
      .then((result) => {
        if (alive) {
          setWorkspaces(normalizeWorkspaces(result));
        }
      })
      .catch(() => {
        // 工作区不可用时保持空列表
      });
    return () => {
      alive = false;
    };
  }, [activeId]);

  const visible = useMemo(() => {
    if (searchResults !== null) {
      return searchResults;
    }
    const query = filter.trim().toLowerCase();
    if (!query) {
      return sessions;
    }
    return sessions.filter((session) => session.title.toLowerCase().includes(query));
  }, [searchResults, sessions, filter]);

  const active = sessions.find((session) => session.id === activeId) ?? null;

  return (
    <div className="chat" data-narrow={narrow} data-view={view}>
      <aside className="chat-list">
        <SessionList
          sessions={visible}
          activeId={activeId}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={selectSession}
          onCreate={createSession}
          onRename={renameSession}
          onDelete={deleteSession}
          onResume={(id) => selectSession(id)}
          onPrune={pruneSessions}
          onBulkDelete={bulkDeleteSessions}
        />
      </aside>

      <section className="chat-main">
        {narrow && active ? (
          <button
            type="button"
            className="ghost chat-back"
            aria-label={t("chat.backToList")}
            onClick={() => setView("list")}
          >
            ‹ {t("chat.showList")}
          </button>
        ) : null}
        {error ? <p className="err chat-error">{error}</p> : null}
        <div className="chat-header">
          <h2 className="chat-title">{active ? active.title : "对话"}</h2>
          <div className="chat-header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={details.open ? t("shell.closeDetails") : t("shell.openDetails")}
              aria-pressed={details.open}
              onClick={details.toggle}
            >
              <Icon name="panel" />
            </button>
          </div>
        </div>
        {active ? (
          <>
            <div className="chat-toolbar">
              <label className="session-menu-btn chat-import">
                <input
                  type="file"
                  className="composer-file"
                  aria-label="导入会话"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void importSession(file);
                    }
                    event.target.value = "";
                  }}
                />
                导入
              </label>
              <button type="button" className="ghost" onClick={exportSession}>
                导出
              </button>
              <button type="button" className="ghost" onClick={shareSession}>
                分享
              </button>
              <button
                type="button"
                className="ghost"
                aria-pressed={subagentsOpen}
                onClick={() => setSubagentsOpen((value) => !value)}
              >
                {t("chat.subagents")}
              </button>
              <button
                type="button"
                className="ghost"
                aria-pressed={imageOpen}
                onClick={() => setImageOpen((value) => !value)}
              >
                {t("chat.image")}
              </button>
              <button
                type="button"
                className="ghost"
                aria-pressed={commandOpen}
                onClick={() => setCommandOpen((value) => !value)}
              >
                {t("cmd.open")}
              </button>
              <button
                type="button"
                className="ghost"
                aria-pressed={contextOpen}
                onClick={() => setContextOpen((value) => !value)}
              >
                {t("context.open")}
              </button>
              <button
                type="button"
                className="ghost"
                aria-pressed={personalityOpen}
                onClick={() => setPersonalityOpen((value) => !value)}
              >
                {t("chat.personality")}
              </button>
              <select
                className="chat-workspace"
                aria-label="工作区"
                value={workspace}
                onChange={(event) => handleWorkspaceChange(event.target.value)}
              >
                <option value="">选择工作区</option>
                {workspaces.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </div>
            {shareLink ? <p className="muted chat-share">{shareLink}</p> : null}
            {subagentsOpen ? (
              <SubagentsPanel
                sessionId={activePair()?.runtimeId ?? null}
                onClose={() => setSubagentsOpen(false)}
              />
            ) : null}
            {imageOpen ? <ImageGenAction onClose={() => setImageOpen(false)} /> : null}
            {contextOpen ? <ContextFilesPanel onClose={() => setContextOpen(false)} /> : null}
            {personalityOpen ? (
              <PersonalityPanel onClose={() => setPersonalityOpen(false)} />
            ) : null}
            {commandOpen ? (
              <CommandPanel
                onClose={() => setCommandOpen(false)}
                onResult={(text) =>
                  setItems((current) => [
                    ...current,
                    { kind: "notice", id: nextId(), level: "done", text },
                  ])
                }
              />
            ) : null}
            <Transcript items={items} />
            {pending.length > 0 ? (
              <div className="pending-requests">
                {pending.map((request) => (
                  <ServerRequestCard
                    key={request.id}
                    request={request}
                    onRespond={(result) => answerRequest(request.id, result)}
                  />
                ))}
              </div>
            ) : null}
            <Composer
              running={running}
              onSend={handleSend}
              onStop={handleStop}
              attachments={attachments}
              onAttach={handleAttach}
              onRemoveAttachment={removeAttachment}
              commands={commands}
              onSlash={handleSlash}
            />
            <StatusBar status={status} />
          </>
        ) : (
          <EmptyState
            title="开始你的对话"
            description="选择左侧已有会话，或新建会话与智能体开始对话。"
            action={
              <Button variant="primary" onClick={createSession}>
                新建会话
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
