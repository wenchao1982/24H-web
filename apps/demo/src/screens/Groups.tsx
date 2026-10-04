import { useState, type ReactNode } from "react";
import { Hash, Plus, Search, Settings2, Users, X } from "lucide-react";
import { GROUP_MESSAGES, GROUP_ROOMS, MODELS, NATIVE_AGENTS } from "../mocks/data";
import type { GroupRoom } from "../mocks/types";
import { Composer } from "../components/Composer";
import { Transcript } from "../components/Transcript";
import { cn } from "../lib/cn";

/** 群聊：房间列表 + 成员增删改 + 多 agent 对话（含建房间选模型）。 */
export function Groups() {
  const [rooms, setRooms] = useState<GroupRoom[]>(GROUP_ROOMS);
  const [roomId, setRoomId] = useState(GROUP_ROOMS[0].id);
  const [membersOpen, setMembersOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const active = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const members = NATIVE_AGENTS.filter((a) => active.members.includes(a.id));

  const setMembers = (ids: string[]) =>
    setRooms((list) => list.map((r) => (r.id === active.id ? { ...r, members: ids } : r)));

  const createRoom = (room: GroupRoom) => {
    setRooms((list) => [...list, room]);
    setRoomId(room.id);
    setNewOpen(false);
  };

  return (
    <div className="flex h-full min-h-0">
      {/* 房间列表 */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-line-1">
        <div className="flex h-12 items-center gap-2 px-3">
          <h1 className="text-[14px] font-medium">群聊</h1>
          <span className="rounded-pill bg-s3 px-1.5 py-px text-[10px] text-label-3">
            {rooms.length}
          </span>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-strong"
            aria-label="新建房间"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-line-1 bg-s1 px-2.5 text-label-3">
            <Search size={14} />
            <input
              placeholder="搜索房间"
              className="h-full flex-1 bg-transparent text-[12.5px] text-label-1 outline-none placeholder:text-label-3"
            />
          </div>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setRoomId(room.id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left transition-colors",
                room.id === roomId ? "bg-accent-weak" : "hover:bg-s3",
              )}
            >
              <span className="flex items-center gap-1.5">
                {room.needsYou ? (
                  <i className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                ) : null}
                <span
                  className={cn(
                    "truncate text-[13px] font-medium",
                    room.id === roomId ? "text-accent" : "text-label-1",
                  )}
                >
                  {room.name}
                </span>
              </span>
              <span className="truncate text-[11px] text-label-3">{room.topic}</span>
              <span className="flex items-center gap-1 text-[11px] text-label-3">
                <Users size={11} />
                {room.members.length} 成员
                <span className="text-line-2">·</span>
                {room.updatedAt}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 对话 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line-1 px-4">
          <Hash size={16} className="text-label-3" />
          <h2 className="truncate text-[14px] font-medium">{active.name}</h2>
          <span className="ml-1 flex items-center">
            {members.map((m) => (
              <span
                key={m.id}
                title={m.name}
                className="group relative -ml-1.5 first:ml-0"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-bg bg-s3 text-[10px] font-semibold text-label-2">
                  {m.avatar}
                </span>
                <button
                  type="button"
                  aria-label={`移除 ${m.name}`}
                  onClick={() => setMembers(active.members.filter((id) => id !== m.id))}
                  className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-white group-hover:flex"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </span>
          <span className="ml-2 truncate text-[12px] text-label-3">{active.topic}</span>
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-line-1 px-2.5 text-[12px] text-label-2 hover:bg-s2"
          >
            <Settings2 size={13} /> 管理成员
          </button>
        </header>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[820px] px-6 py-6">
            <Transcript messages={GROUP_MESSAGES} />
          </div>
        </div>
        <div className="shrink-0 border-t border-line-1 px-6 py-3">
          <div className="mx-auto max-w-[820px]">
            <Composer variant="docked" />
          </div>
        </div>
      </div>

      {membersOpen ? (
        <MembersModal
          memberIds={active.members}
          onChange={setMembers}
          onClose={() => setMembersOpen(false)}
        />
      ) : null}
      {newOpen ? <NewRoomModal onCreate={createRoom} onClose={() => setNewOpen(false)} /> : null}
    </div>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(15_17_21_/_45%)]" onClick={onClose}>
      <div
        className="w-[480px] max-w-[90%] rounded-lg border border-line-1 bg-s1 shadow-[0_8px_24px_rgb(15_17_21_/_16%)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function MembersModal({
  memberIds,
  onChange,
  onClose,
}: {
  memberIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [ids, setIds] = useState(memberIds);
  const toggle = (id: string) =>
    setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <Overlay onClose={onClose}>
      <div className="border-b border-line-1 px-4 py-3 text-[14px] font-medium">管理成员</div>
      <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto p-3">
        {NATIVE_AGENTS.map((a) => {
          const on = ids.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 text-left",
                on ? "border-accent/40 bg-accent-weak" : "border-line-1 hover:bg-s2",
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-s3 text-[11px] font-semibold text-label-2">
                {a.avatar}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-label-1">{a.name}</span>
                <span className="block truncate font-mono text-[11px] text-label-3">{a.runtime}</span>
              </span>
              <span
                className={cn(
                  "flex h-5 w-9 items-center rounded-pill px-0.5",
                  on ? "justify-end bg-accent" : "bg-s3",
                )}
              >
                <span className="h-4 w-4 rounded-full bg-white shadow" />
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-line-1 px-4 py-3">
        <span className="text-[12px] text-label-3">已选 {ids.length} 个</span>
        <span className="flex-1" />
        <button type="button" onClick={onClose} className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">
          取消
        </button>
        <button
          type="button"
          disabled={ids.length < 2}
          onClick={() => {
            onChange(ids);
            onClose();
          }}
          className="h-8 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </Overlay>
  );
}

function NewRoomModal({
  onCreate,
  onClose,
}: {
  onCreate: (room: GroupRoom) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [ids, setIds] = useState<string[]>(["hermes"]);
  const [model, setModel] = useState("deepseek-flash");
  const toggle = (id: string) =>
    setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <Overlay onClose={onClose}>
      <div className="border-b border-line-1 px-4 py-3 text-[14px] font-medium">新建房间</div>
      <div className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-label-2">房间名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：发布就绪评审"
            className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-label-2">主题</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-label-2">成员（2–6）</span>
          <div className="flex flex-wrap gap-1.5">
            {NATIVE_AGENTS.map((a) => {
              const on = ids.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px]",
                    on ? "border-accent/40 bg-accent-weak font-medium text-accent" : "border-line-1 text-label-2 hover:bg-s2",
                  )}
                >
                  <span className="text-[10px]">{a.avatar}</span>
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-label-2">默认模型</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 rounded-md border border-line-1 bg-s1 px-2 text-[13px] text-label-1 outline-none"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2 border-t border-line-1 px-4 py-3">
        <span className="flex-1" />
        <button type="button" onClick={onClose} className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">
          取消
        </button>
        <button
          type="button"
          disabled={!name.trim() || ids.length < 2 || ids.length > 6}
          onClick={() =>
            onCreate({
              id: `g-${Date.now()}`,
              name,
              topic: topic || "（无主题）",
              members: ids,
              updatedAt: "刚刚",
            })
          }
          className="h-8 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          创建
        </button>
      </div>
    </Overlay>
  );
}
