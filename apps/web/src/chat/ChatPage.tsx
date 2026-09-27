import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGateway } from "./GatewayProvider";
import { api } from "../api/client";
import { useMediaQuery } from "../shell/useMediaQuery";
import { t } from "../i18n";
import SessionList from "./SessionList";
import Transcript from "./Transcript";
import Composer from "./Composer";
import StatusBar from "./StatusBar";
import ServerRequestCard from "./ServerRequestCard";
import SubagentsPanel from "./SubagentsPanel";
import ImageGenAction from "./ImageGenAction";
import {
  appendDelta,
  completeAssistant,
  deltaText,
  errorText,
  isSameSession,
  normalizeCreatedId,
  normalizeReplayed,
  normalizeSessions,
  normalizeWorkspaces,
  parseStatus,
  toolDetail,
  toolId,
  toolName,
  toolResult,
  upsertTool,
  type Attachment,
  type PendingRequest,
  type RequestKind,
  type SessionSummary,
  type StatusInfo,
  type TranscriptItem,
} from "./types";

const REQUEST_KINDS: RequestKind[] = ["approval", "clarify", "sudo", "secret", "mcp.setup"];

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
  const narrow = useMediaQuery("(max-width: 900px)");
  const [view, setView] = useState<"list" | "chat">("list");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const activeIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    gateway.on("message.delta", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      const text = deltaText(payload);
      if (text) {
        setItems((current) => appendDelta(current, text, nextId()));
      }
    });
    gateway.on("message.complete", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      setItems((current) => completeAssistant(current, deltaText(payload), nextId()));
    });
    gateway.on("tool.start", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      setItems((current) =>
        upsertTool(current, toolId(payload), toolName(payload), "start", {
          detail: toolDetail(payload),
        }),
      );
    });
    gateway.on("tool.generating", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      setItems((current) =>
        upsertTool(current, toolId(payload), toolName(payload), "generating", {
          detail: toolDetail(payload),
        }),
      );
    });
    gateway.on("tool.complete", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      setItems((current) =>
        upsertTool(current, toolId(payload), toolName(payload), "complete", {
          result: toolResult(payload),
        }),
      );
    });
    gateway.on("thinking", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      setStatus({ phase: "thinking", ...parseStatus(payload) });
    });
    gateway.on("done", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      setRunning(false);
      setStatus({ phase: "done" });
    });
    gateway.on("error", (payload) => {
      if (!isSameSession(payload, activeIdRef.current)) {
        return;
      }
      setRunning(false);
      setStatus({ phase: "error", error: errorText(payload) });
      setItems((current) => [
        ...current,
        { kind: "notice", id: nextId(), level: "error", text: errorText(payload) },
      ]);
    });
  }, [gateway, nextId]);

  useEffect(() => {
    for (const kind of REQUEST_KINDS) {
      gateway.onServerRequest(kind, (params, respond) => {
        const id = nextId();
        respondersRef.current.set(id, respond);
        setPending((current) => [...current, { id, kind, params }]);
      });
    }
  }, [gateway, nextId]);

  // 断线重放：切换会话时拉取待处理服务端请求快照，重新渲染卡片。
  useEffect(() => {
    if (!activeId) {
      return;
    }
    let alive = true;
    gateway
      .request("session.events.since", { session_id: activeId })
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
  }, [activeId, gateway]);

  const linkedRef = useRef(false);
  // 通知中心直达：`/chat?session=<id>` 选中该会话（仅一次）。
  useEffect(() => {
    if (linkedRef.current || sessions.length === 0 || typeof window === "undefined") {
      return;
    }
    const target = new URLSearchParams(window.location.search).get("session");
    if (target && sessions.some((session) => session.id === target)) {
      linkedRef.current = true;
      setActiveId(target);
      setItems([]);
    }
  }, [sessions]);

  const createSession = useCallback(async () => {
    try {
      const result = await gateway.request("session.create", {});
      const id = normalizeCreatedId(result);
      if (!id) {
        return;
      }
      setSessions((current) =>
        current.some((session) => session.id === id)
          ? current
          : [{ id, title: "新会话" }, ...current],
      );
      setActiveId(id);
      setItems([]);
    } catch {
      setError("无法新建会话");
    }
  }, [gateway]);

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
    setItems([]);
  }, []);

  const renameSession = useCallback(
    async (id: string, title: string) => {
      try {
        await gateway.request("session.title", { session_id: id, title });
        setSessions((current) =>
          current.map((session) => (session.id === id ? { ...session, title } : session)),
        );
      } catch {
        setError("重命名失败");
      }
    },
    [gateway],
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

  const resumeSession = useCallback(
    async (id: string) => {
      try {
        await gateway.request("session.resume", { session_id: id });
        setActiveId(id);
        setItems([]);
      } catch {
        setError("恢复失败");
      }
    },
    [gateway],
  );

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
      const sessionId = activeIdRef.current;
      if (!sessionId) {
        return;
      }
      setItems((current) => [
        ...current,
        { kind: "message", id: nextId(), role: "user", text },
      ]);
      setRunning(true);
      setStatus({ phase: "thinking" });
      const payload: Record<string, unknown> = { session_id: sessionId, text };
      if (attachments.length > 0) {
        payload.attachments = attachments.map((attachment) => attachment.id);
      }
      setAttachments([]);
      gateway.request("prompt.submit", payload).catch(() => {
        setRunning(false);
        setError("发送失败");
      });
    },
    [attachments, gateway, nextId],
  );

  const handleStop = useCallback(() => {
    const sessionId = activeIdRef.current;
    if (!sessionId) {
      return;
    }
    gateway
      .request("session.interrupt", { session_id: sessionId })
      .catch(() => {
        setError("无法中断");
      })
      .finally(() => setRunning(false));
  }, [gateway]);

  const handleAttach = useCallback(
    (files: File[]) => {
      const sessionId = activeIdRef.current;
      if (!sessionId) {
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
            session_id: sessionId,
            name: file.name,
            size: file.size,
            type: file.type,
          })
          .catch(() => setError("附件上传失败"));
      }
    },
    [gateway, nextId],
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
      const sessionId = activeIdRef.current;
      if (!sessionId || !value) {
        return;
      }
      gateway
        .request("session.workspace.move", { session_id: sessionId, workspace: value })
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
          onResume={resumeSession}
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
        <h2 className="chat-title">{active ? active.title : "对话"}</h2>
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
              <SubagentsPanel sessionId={activeId} onClose={() => setSubagentsOpen(false)} />
            ) : null}
            {imageOpen ? <ImageGenAction onClose={() => setImageOpen(false)} /> : null}
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
            />
            <StatusBar status={status} />
          </>
        ) : (
          <p className="empty chat-hint">选择或新建一个会话开始对话。</p>
        )}
      </section>
    </div>
  );
}
