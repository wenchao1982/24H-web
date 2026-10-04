import { useState } from "react";
import { FolderPlus, FolderTree, PanelRightOpen, Plus, Star, Trash2, X } from "lucide-react";
import { PROJECTS } from "../mocks/data";
import type { ProjectInfo } from "../mocks/types";
import { cn } from "../lib/cn";

/** 工作区（项目）：具名多文件夹，供对话/任务选择。 */
export function Projects() {
  const [projects, setProjects] = useState<ProjectInfo[]>(PROJECTS);
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [editing, setEditing] = useState<ProjectInfo | "new" | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const active = projects.find((p) => p.id === projectId) ?? projects[0];

  const patch = (id: string, updater: (p: ProjectInfo) => ProjectInfo) =>
    setProjects((list) => list.map((p) => (p.id === id ? updater(p) : p)));

  const setDefault = (id: string) =>
    setProjects((list) => list.map((p) => ({ ...p, isDefault: p.id === id })));

  const addFolder = () => {
    const value = newFolder.trim();
    if (!value) return;
    patch(active.id, (p) => ({ ...p, folders: [...p.folders, value] }));
    setNewFolder("");
  };

  const upsert = (project: ProjectInfo) => {
    setProjects((list) =>
      list.some((p) => p.id === project.id) ? list.map((p) => (p.id === project.id ? project : p)) : [...list, project],
    );
    setProjectId(project.id);
    setEditing(null);
  };

  const remove = (id: string) => {
    setProjects((list) => list.filter((p) => p.id !== id));
    setEditing(null);
    setProjectId((cur) => (cur === id ? projects.find((p) => p.id !== id)?.id ?? "" : cur));
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[300px] shrink-0 flex-col border-r border-line-1">
        <div className="flex h-12 items-center gap-2 px-3">
          <h1 className="text-[14px] font-medium">工作区</h1>
          <span className="rounded-pill bg-s3 px-1.5 py-px text-[10px] text-label-3">
            {projects.length}
          </span>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-strong"
            aria-label="新建工作区"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProjectId(p.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
                p.id === projectId ? "bg-accent-weak" : "hover:bg-s3",
              )}
            >
              <span className="flex items-center gap-1.5">
                <FolderTree size={14} className={p.id === projectId ? "text-accent" : "text-label-3"} />
                <span className={cn("truncate text-[13px] font-medium", p.id === projectId ? "text-accent" : "text-label-1")}>
                  {p.name}
                </span>
                {p.isDefault ? <Star size={11} className="ml-auto text-warning" fill="currentColor" /> : null}
              </span>
              <span className="truncate pl-[22px] text-[11px] text-label-3">
                {p.folders.length} 文件夹 · {p.lastUsed ?? "未使用"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="thin-scroll min-w-0 flex-1 overflow-y-auto px-6 py-5">
        {active ? (
          <div className="mx-auto max-w-[720px]">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold">{active.name}</h2>
              <button
                type="button"
                onClick={() => setDefault(active.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium",
                  active.isDefault ? "bg-warning-weak text-warning" : "bg-s3 text-label-3 hover:text-label-1",
                )}
              >
                <Star size={11} fill={active.isDefault ? "currentColor" : "none"} />
                {active.isDefault ? "默认工作区" : "设为默认"}
              </button>
              <button
                type="button"
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2"
              >
                <PanelRightOpen size={14} /> 在面板打开
              </button>
              <button
                type="button"
                onClick={() => setEditing(active)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2"
              >
                编辑
              </button>
            </div>
            {active.description ? <p className="mt-1 text-[12.5px] text-label-3">{active.description}</p> : null}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="文件夹" value={active.folders.length} />
              <Stat label="关联对话" value={2} />
              <Stat label="关联任务" value={1} />
            </div>

            <p className="mt-5 mb-2 text-[12px] font-medium text-label-3">文件夹</p>
            <div className="flex flex-col gap-1.5">
              {active.folders.map((f) => (
                <div key={f} className="group flex items-center gap-2.5 rounded-md border border-line-1 bg-s1 px-3.5 py-2.5">
                  <FolderTree size={14} className="text-label-3" />
                  <span className="flex-1 truncate font-mono text-[12.5px] text-label-1">{f}</span>
                  <button
                    type="button"
                    aria-label={`移除 ${f}`}
                    onClick={() => patch(active.id, (p) => ({ ...p, folders: p.folders.filter((x) => x !== f) }))}
                    className="flex h-5 w-5 items-center justify-center rounded text-label-3 opacity-0 hover:bg-s2 hover:text-danger group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-dashed border-line-2 px-2.5 text-label-3">
                <FolderPlus size={14} />
                <input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFolder()}
                  placeholder="添加文件夹路径，如 /work/extra"
                  className="h-full flex-1 bg-transparent text-[12.5px] text-label-1 outline-none placeholder:text-label-3"
                />
              </div>
              <button
                type="button"
                onClick={addFolder}
                className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2"
              >
                添加
              </button>
            </div>

            <button
              type="button"
              onClick={() => remove(active.id)}
              className="mt-6 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] text-danger hover:bg-s2"
            >
              <Trash2 size={14} /> 删除工作区
            </button>
          </div>
        ) : (
          <p className="mt-10 text-center text-[13px] text-label-3">暂无工作区。</p>
        )}
      </div>

      {editing ? (
        <ProjectModal
          project={editing === "new" ? null : editing}
          onSave={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line-1 bg-s1 px-3 py-2.5 text-center">
      <p className="text-[18px] font-semibold">{value}</p>
      <p className="text-[11px] text-label-3">{label}</p>
    </div>
  );
}

function ProjectModal({
  project,
  onSave,
  onClose,
}: {
  project: ProjectInfo | null;
  onSave: (p: ProjectInfo) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProjectInfo>(
    project ?? { id: `p-${Date.now()}`, name: "", description: "", folders: [] },
  );
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(15_17_21_/_45%)]" onClick={onClose}>
      <div className="w-[460px] max-w-[90%] rounded-lg border border-line-1 bg-s1 shadow-[0_8px_24px_rgb(15_17_21_/_16%)]" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line-1 px-4 py-3 text-[14px] font-medium">{project ? "编辑工作区" : "新建工作区"}</div>
        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">名称</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">描述</span>
            <input
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50"
            />
          </label>
          <p className="text-[11px] text-label-3">创建后可在详情里添加/移除文件夹。</p>
        </div>
        <div className="flex items-center gap-2 border-t border-line-1 px-4 py-3">
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">取消</button>
          <button
            type="button"
            disabled={!draft.name.trim()}
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
