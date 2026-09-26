import { useEffect, useMemo, useState } from "react";
import { useGateway } from "./GatewayProvider";
import SessionList from "./SessionList";
import { normalizeSessions, type SessionSummary } from "./types";

export default function ChatPage() {
  const gateway = useGateway();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

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
          onSelect={setActiveId}
        />
      </aside>

      <section className="chat-main">
        {error ? <p className="err chat-error">{error}</p> : null}
        <h2 className="chat-title">{active ? active.title : "对话"}</h2>
        {active ? null : <p className="empty chat-hint">选择或新建一个会话开始对话。</p>}
      </section>
    </div>
  );
}
