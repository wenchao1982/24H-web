import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGateway } from "./GatewayProvider";
import SessionList from "./SessionList";
import Transcript from "./Transcript";
import Composer from "./Composer";
import {
  appendDelta,
  completeAssistant,
  deltaText,
  isSameSession,
  normalizeCreatedId,
  normalizeSessions,
  type SessionSummary,
  type TranscriptItem,
} from "./types";

export default function ChatPage() {
  const gateway = useGateway();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);

  const activeIdRef = useRef<string | null>(null);
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
      gateway.request("prompt.submit", { session_id: sessionId, text }).catch(() => {
        setError("发送失败");
      });
    },
    [gateway, nextId],
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
        />
      </aside>

      <section className="chat-main">
        {error ? <p className="err chat-error">{error}</p> : null}
        <h2 className="chat-title">{active ? active.title : "对话"}</h2>
        {active ? (
          <>
            <Transcript items={items} />
            <Composer onSend={handleSend} />
          </>
        ) : (
          <p className="empty chat-hint">选择或新建一个会话开始对话。</p>
        )}
      </section>
    </div>
  );
}
