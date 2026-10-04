import { useState } from "react";
import { Brain, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { MEMORY_ENTRIES, MEMORY_PROVIDERS, NATIVE_AGENTS } from "../mocks/data";
import type { MemoryEntry } from "../mocks/types";
import { cn } from "../lib/cn";

const CATEGORIES = ["全部", "事实", "偏好", "项目", "系统"] as const;
const CAT_STYLE: Record<string, string> = {
  事实: "bg-s3 text-label-2",
  偏好: "bg-accent-weak text-accent",
  项目: "bg-success/10 text-success",
  系统: "bg-warning-weak text-warning",
};

/** 记忆：分类/作用域/提供方 + 增删改查。 */
export function Memory() {
  const [entries, setEntries] = useState<MemoryEntry[]>(MEMORY_ENTRIES);
  const [provider, setProvider] = useState<string>("local");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("全部");
  const [scope, setScope] = useState("全部");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MemoryEntry | "new" | null>(null);

  const filtered = entries.filter(
    (e) =>
      (cat === "全部" || e.category === cat) &&
      (scope === "全部" || e.scope === scope) &&
      (e.text.includes(query) || e.source.includes(query)),
  );

  const upsert = (entry: MemoryEntry) => {
    setEntries((list) =>
      list.some((e) => e.id === entry.id) ? list.map((e) => (e.id === entry.id ? entry : e)) : [...list, entry],
    );
    setEditing(null);
  };
  const remove = (id: string) => setEntries((list) => list.filter((e) => e.id !== id));

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-6 py-6">
        <div className="flex items-center gap-2">
          <h1 className="flex items-center gap-2 text-[18px] font-semibold">
            <Brain size={18} className="text-label-3" /> 记忆
          </h1>
          <span className="rounded-pill border border-line-1 px-2.5 py-1 text-[12px] text-label-2">
            {entries.length} 条
          </span>
          <button
            type="button"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2"
          >
            <RotateCcw size={14} /> 重置
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong"
          >
            <Plus size={14} /> 新增
          </button>
        </div>

        <section className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line-1 bg-s1 p-3.5">
          <span className="text-[12.5px] text-label-2">记忆提供方</span>
          <div className="flex items-center gap-1">
            {MEMORY_PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-mono text-[12px]",
                  provider === p ? "border-accent/40 bg-accent-weak font-medium text-accent" : "border-line-1 text-label-2 hover:bg-s2",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-label-3">提供方决定记忆的存储与检索方式</span>
        </section>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-pill px-2.5 py-1 text-[12px]",
                  cat === c ? "bg-accent-weak font-medium text-accent" : "text-label-2 hover:bg-s2",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-7 rounded-md border border-line-1 bg-s1 px-2 text-[12px] text-label-2 outline-none"
          >
            <option value="全部">全部作用域</option>
            <option value="全局">全局</option>
            {NATIVE_AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="ml-auto flex h-7 w-44 items-center gap-2 rounded-md border border-line-1 bg-s1 px-2.5 text-label-3">
            <Search size={13} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索记忆"
              className="h-full flex-1 bg-transparent text-[12px] text-label-1 outline-none placeholder:text-label-3"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-2 px-4 py-8 text-center text-[12.5px] text-label-3">
              没有匹配的记忆。
            </p>
          ) : (
            filtered.map((m) => (
              <div key={m.id} className="group flex items-start gap-3 rounded-lg border border-line-1 bg-s1 px-3.5 py-3">
                <span className={cn("mt-0.5 shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-medium", CAT_STYLE[m.category])}>
                  {m.category}
                </span>
                <span className="min-w-0 flex-1">
                  <p className="text-[13px] leading-relaxed text-label-1">{m.text}</p>
                  <p className="mt-1 flex items-center gap-2 text-[11px] text-label-3">
                    <span className="rounded-pill bg-s3 px-2 py-0.5">
                      {m.scope === "全局" ? "全局" : NATIVE_AGENTS.find((a) => a.id === m.scope)?.name ?? m.scope}
                    </span>
                    {m.source}
                    <span>·</span>
                    {m.at}
                  </p>
                </span>
                <span className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button type="button" onClick={() => setEditing(m)} aria-label="编辑" className="flex h-6 w-6 items-center justify-center rounded text-label-3 hover:bg-s2 hover:text-label-1">
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => remove(m.id)} aria-label="删除" className="flex h-6 w-6 items-center justify-center rounded text-label-3 hover:bg-s2 hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {editing ? (
        <MemoryModal
          entry={editing === "new" ? null : editing}
          onSave={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function MemoryModal({
  entry,
  onSave,
  onClose,
}: {
  entry: MemoryEntry | null;
  onSave: (entry: MemoryEntry) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MemoryEntry>(
    entry ?? { id: `mem-${Date.now()}`, text: "", category: "事实", scope: "全局", source: "显式添加", at: "刚刚" },
  );
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(15_17_21_/_45%)]" onClick={onClose}>
      <div className="w-[460px] max-w-[90%] rounded-lg border border-line-1 bg-s1 shadow-[0_8px_24px_rgb(15_17_21_/_16%)]" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line-1 px-4 py-3 text-[14px] font-medium">{entry ? "编辑记忆" : "新增记忆"}</div>
        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">内容</span>
            <textarea
              rows={3}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              className="resize-none rounded-md border border-line-1 bg-s1 px-3 py-2 text-[13px] outline-none focus:border-accent/50"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-label-2">分类</span>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as MemoryEntry["category"] })}
                className="h-9 rounded-md border border-line-1 bg-s1 px-2 text-[13px] outline-none"
              >
                {["事实", "偏好", "项目", "系统"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-label-2">作用域</span>
              <select
                value={draft.scope}
                onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                className="h-9 rounded-md border border-line-1 bg-s1 px-2 text-[13px] outline-none"
              >
                <option value="全局">全局</option>
                {NATIVE_AGENTS.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-line-1 px-4 py-3">
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">取消</button>
          <button
            type="button"
            disabled={!draft.text.trim()}
            onClick={() => onSave(draft)}
            className="h-8 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
