import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGateway } from "./GatewayProvider";
import SessionList from "./SessionList";
import Transcript from "./Transcript";
import Composer from "./Composer";
import StatusBar from "./StatusBar";
import ServerRequestCard from "./ServerRequestCard";
import {
  appendDelta,
  completeAssistant,
  deltaText,
  errorText,
  isSameSession,
  normalizeCreatedId,
  normalizeSessions,
  parseStatus,
  toolDetail,
  toolId,
  toolName,
  toolResult,
  upsertTool,
  type PendingRequest,
  type RequestKind,
  type SessionSummary,
  type StatusInfo,
  type TranscriptItem,
} from "./types";

const REQUEST_KINDS: RequestKind[] = ["approval", "clarify", "sudo", "secret", "mcp.setup"];

export default function ChatPage() {
  const gateway = useGateway();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<StatusInfo | null>(null);

  const activeIdRef = useRef<string | null>(null);
  const respondersRef = useRef(new Map<string, (result: Record<string, unknown>) => void>());
  const seqRef = useRef(0);
  const nextId = useCallback(() => `i${seqRef.current++}`, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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
      gateway.request("prompt.submit", { session_id: sessionId, text }).catch(() => {
        setRunning(false);
        setError("发送失败");
      });
    },
    [gateway, nextId],
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

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return sessions;
    }
    return sessions.filter((session) => session.title.toLowerCase().includes(query));
  }, [sessions, filter]);

  const active = sessions.find((session) => session.id === activeId) ?? null;

  return (
    <div className="chat">
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
        />
      </aside>

      <section className="chat-main">
        {error ? <p className="err chat-error">{error}</p> : null}
        <h2 className="chat-title">{active ? active.title : "对话"}</h2>
        {active ? (
          <>
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
            <Composer running={running} onSend={handleSend} onStop={handleStop} />
            <StatusBar status={status} />
          </>
        ) : (
          <p className="empty chat-hint">选择或新建一个会话开始对话。</p>
        )}
      </section>
    </div>
  );
}
