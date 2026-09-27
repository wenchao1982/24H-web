import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import {
  isGroupsSupported,
  normalizeMessages,
  normalizeRooms,
  type GroupMember,
  type GroupMessage,
  type GroupRoom,
} from "./groups";

/**
 * 群聊页（T17.1）：房间列表 + 新建房间 + 房间多 agent 转录。
 * 经 L1 `groups.*`；`groups.capabilities` 探测不支持时展示说明性空态（不崩溃）。
 */
export default function GroupChatPage() {
  const gateway = useGateway();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<GroupRoom[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await gateway.connect();
    } catch {
      // 已连接时忽略
    }
    try {
      const caps = await gateway.request("groups.capabilities", {});
      if (!isGroupsSupported(caps)) {
        setSupported(false);
        setRooms([]);
        return;
      }
      const result = await gateway.request("groups.list", {});
      setRooms(normalizeRooms(result));
      setSupported(true);
      setError(null);
    } catch {
      setSupported(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRoom = useCallback(
    async (room: GroupRoom) => {
      setActiveId(room.id);
      setMessages(room.messages);
      try {
        const result = await gateway.request("groups.messages", { room_id: room.id });
        setMessages(normalizeMessages(result));
      } catch {
        // 转录拉取失败时保留列表内嵌消息
      }
    },
    [gateway],
  );

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    const roomName = name.trim();
    if (!roomName) {
      return;
    }
    try {
      await gateway.request("groups.create", { name: roomName });
      setName("");
      setError(null);
      await load();
    } catch {
      setError(t("groups.error.create"));
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId) {
      return;
    }
    setMessages((current) => [...current, { id: `local-${current.length}`, sender: "我", text }]);
    setDraft("");
    try {
      await gateway.request("groups.send", { room_id: activeId, text });
    } catch {
      setError(t("groups.error.send"));
    }
  };

  const mention = (member: GroupMember) => {
    setDraft((current) => `${current}@${member.name} `);
  };

  if (supported === null) {
    return <p className="empty">{t("groups.loading")}</p>;
  }

  if (!supported) {
    return (
      <div className="page groups-page">
        <p className="empty">{t("groups.unsupported")}</p>
      </div>
    );
  }

  const active = rooms.find((room) => room.id === activeId) ?? null;

  return (
    <div className="chat groups-page">
      <aside className="chat-list">
        <div className="session-list">
          <form className="card" onSubmit={createRoom}>
            <input
              aria-label={t("groups.name")}
              placeholder={t("groups.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="primary" type="submit">
              {t("groups.create")}
            </button>
          </form>
          {rooms.length === 0 ? (
            <p className="empty">{t("groups.empty")}</p>
          ) : (
            <ul className="session-items">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    className="session-item"
                    data-active={room.id === activeId}
                    aria-label={t("groups.selectRoom", { name: room.name })}
                    onClick={() => void openRoom(room)}
                  >
                    {room.name}
                    {room.members.length > 0
                      ? ` · ${t("groups.memberCount", { count: room.members.length })}`
                      : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="chat-main">
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {active ? (
          <>
            <h2 className="chat-title">{active.name}</h2>
            {active.members.length > 0 ? (
              <div className="chat-toolbar" aria-label={t("groups.members")}>
                {active.members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="ghost"
                    aria-label={t("groups.mention", { name: member.name })}
                    onClick={() => mention(member)}
                  >
                    @{member.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="transcript">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="bubble"
                  data-role={message.sender === "我" ? "user" : "assistant"}
                >
                  {message.sender !== "我" ? <strong>{message.sender}：</strong> : null}
                  {message.text}
                </div>
              ))}
            </div>
            <div className="composer">
              <input
                className="composer-input"
                aria-label={t("groups.placeholder")}
                placeholder={t("groups.placeholder")}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <button className="primary" type="button" onClick={() => void send()}>
                {t("groups.send")}
              </button>
            </div>
          </>
        ) : (
          <p className="empty chat-hint">{t("groups.noRoom")}</p>
        )}
      </section>
    </div>
  );
}
