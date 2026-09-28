import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { ConfirmDialog, EmptyState } from "../ui";
import { agentInitial, normalizeAgentList, type AgentSummary } from "../agents/agents";
import {
  buildMemberInputs,
  isGroupsSupported,
  MAX_GROUP_MEMBERS,
  MIN_GROUP_MEMBERS,
  newIdentifier,
  normalizeLogEvents,
  normalizeRoomState,
  normalizeRooms,
  type GroupMember,
  type GroupMessage,
  type GroupRoom,
} from "./groups";

/**
 * 群聊页（T17.1）：房间列表 + 新建房间（选成员）+ 房间多 agent 转录。
 *
 * 经 L1 `groups.*`（官方 hosted rooms）：`capabilities` / `list` / `create` / `state` /
 * `log` / `send` / `rename` / `disband`。成员 roster 在创建时冻结（2–6 名本地 profile，
 * `validate_roster`）；官方无「增删成员」RPC，故成员仅能在创建时选择，「编辑」仅支持
 * 改名（`groups.rename`）。`groups.capabilities` 缺失或 `driver:false` 时展示说明性空态。
 */
export default function GroupChatPage() {
  const gateway = useGateway();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<AgentSummary[]>([]);
  const [rooms, setRooms] = useState<GroupRoom[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [disbandTarget, setDisbandTarget] = useState<GroupRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<string>("");

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
      const roomList = await gateway.request("groups.list", {});
      setRooms(normalizeRooms(roomList));
      setSupported(true);
      setError(null);
    } catch {
      setSupported(false);
      return;
    }
    try {
      const profileList = await gateway.request("profiles.list", { include_sessions: false });
      setProfiles(normalizeAgentList(profileList));
    } catch {
      // 无法取成员时不影响浏览已有房间
      setProfiles([]);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshLog = useCallback(
    async (roomId: string) => {
      try {
        const log = await gateway.request("groups.log", { room_id: roomId, since_seq: 0 });
        setMessages(normalizeLogEvents(log));
      } catch {
        // 转录拉取失败时保留已有消息
      }
    },
    [gateway],
  );

  const openRoom = useCallback(
    async (room: GroupRoom) => {
      setActiveId(room.id);
      setMessages(room.messages);
      setRenameDraft(room.name);
      threadRef.current = newIdentifier("thread");
      try {
        const state = await gateway.request("groups.state", { room_id: room.id });
        const normalized = normalizeRoomState(state);
        if (normalized) {
          setRooms((current) =>
            current.map((item) =>
              item.id === room.id
                ? { ...item, name: normalized.name, members: normalized.members }
                : item,
            ),
          );
        }
      } catch {
        // state 拉取失败时沿用 list 内嵌成员
      }
      await refreshLog(room.id);
    },
    [gateway, refreshLog],
  );

  const toggleMember = (profileName: string) => {
    setSelected((current) =>
      current.includes(profileName)
        ? current.filter((item) => item !== profileName)
        : [...current, profileName],
    );
  };

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (selected.length < MIN_GROUP_MEMBERS) {
      setError(t("groups.error.members"));
      return;
    }
    if (selected.length > MAX_GROUP_MEMBERS) {
      setError(t("groups.error.members"));
      return;
    }
    const members = buildMemberInputs(
      profiles.filter((profile) => selected.includes(profile.name)),
    );
    const roomName = name.trim() || t("groups.defaultName");
    try {
      await gateway.request("groups.create", {
        room_id: newIdentifier("room"),
        name: roomName,
        members,
      });
      setName("");
      setSelected([]);
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
    if (!threadRef.current) {
      threadRef.current = newIdentifier("thread");
    }
    const threadId = threadRef.current;
    setMessages((current) => [...current, { id: `local-${current.length}`, sender: "我", text }]);
    setDraft("");
    try {
      await gateway.request("groups.send", {
        room_id: activeId,
        event_id: newIdentifier("event"),
        payload: { text, thread_id: threadId },
      });
      setError(null);
      await refreshLog(activeId);
    } catch {
      setError(t("groups.error.send"));
    }
  };

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeId) {
      return;
    }
    const next = renameDraft.trim();
    if (!next) {
      return;
    }
    try {
      await gateway.request("groups.rename", {
        room_id: activeId,
        event_id: newIdentifier("event"),
        name: next,
      });
      setError(null);
      await load();
    } catch {
      setError(t("groups.error.rename"));
    }
  };

  const disband = async (room: GroupRoom) => {
    try {
      await gateway.request("groups.disband", { room_id: room.id });
      if (activeId === room.id) {
        setActiveId(null);
        setMessages([]);
      }
      await load();
    } catch {
      setError(t("groups.error.disband"));
    }
  };

  const mention = (member: GroupMember) => {
    setDraft((current) => `${current}@${member.handle || member.name} `);
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
  const query = memberSearch.trim().toLowerCase();
  const filteredProfiles = query
    ? profiles.filter(
        (profile) =>
          (profile.displayName || profile.name).toLowerCase().includes(query) ||
          profile.name.toLowerCase().includes(query),
      )
    : profiles;
  const selectedProfiles = profiles.filter((profile) => selected.includes(profile.name));
  const valid =
    name.trim() !== "" &&
    selected.length >= MIN_GROUP_MEMBERS &&
    selected.length <= MAX_GROUP_MEMBERS;

  return (
    <div className="chat groups-page">
      <aside className="chat-list">
        <div className="session-list">
          <form className="card groups-create" onSubmit={createRoom}>
            <input
              aria-label={t("groups.name")}
              placeholder={t("groups.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className="group-member-search"
              type="search"
              aria-label={t("groups.searchMembers")}
              placeholder={t("groups.searchMembers")}
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
            <fieldset className="groups-members">
              <legend>{t("groups.pickMembers")}</legend>
              {profiles.length === 0 ? (
                <p className="empty">{t("groups.noMembers")}</p>
              ) : filteredProfiles.length === 0 ? (
                <p className="empty">{t("groups.noMatch")}</p>
              ) : (
                filteredProfiles.map((profile) => (
                  <label key={profile.name} className="groups-member-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(profile.name)}
                      onChange={() => toggleMember(profile.name)}
                      aria-label={t("groups.pickMember", { name: profile.name })}
                    />
                    {profile.displayName || profile.name}
                  </label>
                ))
              )}
            </fieldset>
            {selectedProfiles.length > 0 ? (
              <div className="group-selected-chips">
                {selectedProfiles.map((profile) => (
                  <span key={profile.name} className="group-chip">
                    {profile.displayName || profile.name}
                    <button
                      type="button"
                      className="group-chip-remove"
                      aria-label={t("groups.removeMember", { name: profile.name })}
                      onClick={() => toggleMember(profile.name)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <p className="groups-hint">
              {t("groups.selectedCount", { count: selected.length })}
            </p>
            <button className="primary" type="submit" disabled={!valid}>
              {t("groups.create")}
            </button>
          </form>
          {rooms.length === 0 ? (
            <EmptyState title={t("groups.empty")} description={t("groups.emptyDescription")} />
          ) : (
            <ul className="session-items group-room-list">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    className="session-item group-room-card"
                    data-active={room.id === activeId}
                    aria-label={t("groups.selectRoom", { name: room.name })}
                    onClick={() => void openRoom(room)}
                  >
                    <span className="group-room-head">
                      <span className="group-room-name">{room.name}</span>
                      <span className="group-room-count muted">
                        {t("groups.memberCount", { count: room.members.length })}
                      </span>
                    </span>
                    {room.members.length > 0 ? (
                      <span className="group-room-members" aria-hidden="true">
                        {room.members.slice(0, 4).map((member) => (
                          <span
                            key={member.id}
                            className="group-room-avatar"
                            title={member.name}
                          >
                            {agentInitial(member.name)}
                          </span>
                        ))}
                        {room.members.length > 4 ? (
                          <span className="group-room-avatar group-room-avatar--more">
                            +{room.members.length - 4}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
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
            <form className="chat-toolbar groups-rename" onSubmit={rename}>
              <input
                aria-label={t("groups.renameLabel")}
                placeholder={t("groups.renameLabel")}
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
              />
              <button className="ghost" type="submit">
                {t("groups.saveName")}
              </button>
              <button
                className="ghost"
                type="button"
                aria-label={t("groups.disbandRoom", { name: active.name })}
                onClick={() => setDisbandTarget(active)}
              >
                {t("groups.disband")}
              </button>
            </form>
            {active.members.length > 0 ? (
              <div className="chat-toolbar" aria-label={t("groups.members")}>
                {active.members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="ghost"
                    aria-label={t("groups.mention", { name: member.handle || member.name })}
                    onClick={() => mention(member)}
                  >
                    @{member.handle || member.name}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="groups-hint">{t("groups.rosterLocked")}</p>
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
          <EmptyState title={t("groups.noRoomTitle")} description={t("groups.noRoom")} />
        )}
      </section>

      <ConfirmDialog
        open={disbandTarget !== null}
        title={t("groups.disbandTitle")}
        message={
          disbandTarget ? t("groups.disbandConfirm", { name: disbandTarget.name }) : ""
        }
        confirmLabel={t("groups.disbandConfirmLabel")}
        danger
        onConfirm={() => {
          const target = disbandTarget;
          setDisbandTarget(null);
          if (target) {
            void disband(target);
          }
        }}
        onCancel={() => setDisbandTarget(null)}
      />
    </div>
  );
}
