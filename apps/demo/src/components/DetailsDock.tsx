import { useState } from "react";
import {
  ChevronLeft,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  Package,
  Upload,
  X,
} from "lucide-react";
import { ARTIFACTS, GIT_CHANGES, LOG_LINES, WORKSPACE_FILES } from "../mocks/data";
import type { WorkspaceFile } from "../mocks/types";
import { cn } from "../lib/cn";

const TABS = ["工作区", "产物", "日志", "Git"] as const;
type DockTab = (typeof TABS)[number];

const REPORT_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>body{font-family:system-ui;margin:0;padding:16px;background:#fff;color:#0f1115}
h1{font-size:16px;margin:0 0 4px}p{color:#61666b;font-size:12px;margin:0 0 12px}
.bar{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:12px}
.bar span:first-child{width:74px;color:#81858c}.track{flex:1;height:8px;border-radius:99px;background:#eef0f4;overflow:hidden}
.fill{height:100%;background:#4d6bfe;border-radius:99px}</style></head>
<body><h1>用量报告</h1><p>近 30 天 · 自动生成产物</p>
<div class="bar"><span>v4-pro</span><span class="track"><span class="fill" style="width:78%"></span></span><span>7.16M</span></div>
<div class="bar"><span>flash</span><span class="track"><span class="fill" style="width:52%"></span></span><span>4.62M</span></div>
<div class="bar"><span>sonnet</span><span class="track"><span class="fill" style="width:12%"></span></span><span>0.70M</span></div>
</body></html>`;

export interface DetailsDockProps {
  onClose: () => void;
}

/** 右侧功能面板：关联对话工作区（文件树 + 多格式预览）+ 产物/日志/Git。 */
export function DetailsDock({ onClose }: DetailsDockProps) {
  const [tab, setTab] = useState<DockTab>("工作区");
  const [file, setFile] = useState<WorkspaceFile | null>(null);

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-line-1 bg-s1">
      <div className="flex h-12 shrink-0 items-center gap-0.5 border-b border-line-1 px-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setFile(null);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors",
              tab === t ? "bg-accent-weak font-medium text-accent" : "text-label-2 hover:bg-s2",
            )}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭面板"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-label-3 hover:bg-s2 hover:text-label-1"
        >
          <X size={15} />
        </button>
      </div>

      {tab === "工作区" ? (
        <WorkspaceView file={file} onOpen={setFile} onBack={() => setFile(null)} />
      ) : (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "产物" ? (
            <div className="flex flex-col gap-1.5">
              {ARTIFACTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setTab("工作区")}
                  className="flex items-center gap-2.5 rounded-md border border-line-1 px-3 py-2 text-left hover:bg-s2"
                >
                  <Package size={14} className="text-label-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12px] text-label-1">{a.name}</span>
                    <span className="block text-[11px] text-label-3">{a.kind} · {a.size} · {a.at}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : tab === "日志" ? (
            <div className="flex flex-col gap-1">
              {LOG_LINES.map((l, i) => (
                <div key={i} className="flex items-start gap-2 font-mono text-[11.5px] leading-relaxed">
                  <span className="shrink-0 text-label-3">{l.at}</span>
                  <span className={cn("shrink-0 uppercase", l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warning" : "text-label-3")}>
                    {l.level}
                  </span>
                  <span className="min-w-0 break-words text-label-2">{l.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <GitReviewView />
          )}
        </div>
      )}
    </aside>
  );
}

/** Git 评审 / 发布：状态 + 暂存/还原 + 提交/推送/PR（C06）。 */
function GitReviewView() {
  const [changes, setChanges] = useState(() => GIT_CHANGES.map((c) => ({ ...c, staged: c.status === "M" })));
  const [message, setMessage] = useState("feat: 补齐编排执行器与看板导入");
  const [note, setNote] = useState<string | null>(null);
  const [prPending, setPrPending] = useState(false);

  const toggle = (path: string) => {
    setChanges((list) => list.map((c) => (c.path === path ? { ...c, staged: !c.staged } : c)));
    setNote(null);
  };
  const revert = (path: string) => {
    setChanges((list) => list.filter((c) => c.path !== path));
    setNote(`已还原 ${path}`);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 rounded-md border border-line-1 bg-s1 px-2.5 py-1.5 text-[11.5px] text-label-2">
        <GitBranch size={13} className="text-label-3" />
        <span className="font-mono">feat/orchestration</span>
        <span className="text-label-3">→ main</span>
        <span className="ml-auto text-label-3">领先 3 · 落后 0</span>
      </div>

      <div className="flex flex-col gap-1">
        {changes.length === 0 ? (
          <p className="py-2 text-center text-[12px] text-label-3">工作区干净。</p>
        ) : (
          changes.map((c) => (
            <div key={c.path} className="flex items-center gap-2 font-mono text-[12px]">
              <button
                type="button"
                onClick={() => toggle(c.path)}
                className={cn(
                  "w-5 shrink-0 text-center",
                  c.status === "M" ? "text-warning" : c.status === "A" ? "text-success" : c.status === "D" ? "text-danger" : "text-label-3",
                )}
                aria-label={`暂存 ${c.path}`}
              >
                {c.status}
              </button>
              <span className={cn("truncate", c.staged ? "text-label-1" : "text-label-2")}>{c.path}</span>
              {c.staged ? <span className="shrink-0 text-[10px] text-accent">已暂存</span> : null}
              <button
                type="button"
                onClick={() => revert(c.path)}
                className="ml-auto shrink-0 text-[11px] text-danger hover:underline"
              >
                还原
              </button>
            </div>
          ))
        )}
      </div>

      <textarea
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="提交信息"
        className="rounded-md border border-line-1 bg-s1 px-2.5 py-2 text-[12px] text-label-1 outline-none focus:border-accent/50"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setNote("已提交 3 个文件")}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-white hover:bg-accent-strong"
        >
          提交
        </button>
        <button
          type="button"
          onClick={() => setNote("已推送到 origin/feat/orchestration")}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 px-3 text-[12px] text-label-2 hover:bg-s2"
        >
          <Upload size={13} /> 推送
        </button>
        <button
          type="button"
          onClick={() => {
            setPrPending(true);
            setNote("已创建 PR #128：补齐编排执行器与看板导入");
          }}
          className={cn(
            "ml-auto inline-flex h-8 items-center rounded-md border px-3 text-[12px]",
            prPending ? "border-accent/40 text-accent" : "border-line-1 text-label-2 hover:bg-s2",
          )}
        >
          {prPending ? "PR #128" : "创建 PR"}
        </button>
      </div>
      {note ? <p className="text-[11.5px] text-label-3">{note}</p> : null}
    </div>
  );
}

function fileIcon(kind: WorkspaceFile["kind"]) {
  if (kind === "image") return ImageIcon;
  if (kind === "md") return FileText;
  return FileCode2;
}

function WorkspaceView({
  file,
  onOpen,
  onBack,
}: {
  file: WorkspaceFile | null;
  onOpen: (f: WorkspaceFile) => void;
  onBack: () => void;
}) {
  if (file && file.kind !== "folder") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line-1 px-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-label-2 hover:bg-s2"
          >
            <ChevronLeft size={14} /> 文件
          </button>
          <span className="truncate font-mono text-[12px] text-label-1">{file.path}</span>
          {file.size ? <span className="ml-auto text-[11px] text-label-3">{file.size}</span> : null}
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-auto p-3">
          <FilePreview file={file} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line-1 px-3">
        <FolderOpen size={14} className="text-label-3" />
        <span className="truncate font-mono text-[12px] text-label-1">~/projects/24h-web</span>
        <span className="ml-auto text-[11px] text-label-3">对话工作区</span>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {WORKSPACE_FILES.map((f) => {
          const depth = f.path.split("/").length - 1;
          const Icon = f.kind === "folder" ? Folder : fileIcon(f.kind);
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => (f.kind === "folder" ? undefined : onOpen(f))}
              style={{ paddingLeft: 8 + depth * 14 }}
              className={cn(
                "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[12px]",
                f.kind === "folder" ? "cursor-default text-label-3" : "text-label-1 hover:bg-s2",
              )}
            >
              <Icon size={13} className="shrink-0 text-label-3" />
              <span className="truncate font-mono">{f.name}</span>
              {f.size ? <span className="ml-auto text-[10px] text-label-3">{f.size}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilePreview({ file }: { file: WorkspaceFile }) {
  if (file.kind === "html") {
    return <iframe title={`预览 ${file.name}`} srcDoc={REPORT_HTML} sandbox="" className="h-[440px] w-full rounded-md border border-line-1 bg-white" />;
  }
  if (file.kind === "md") {
    return <Markdown text={file.content ?? ""} />;
  }
  if (file.kind === "csv") {
    return <CsvTable text={file.content ?? ""} />;
  }
  if (file.kind === "image") {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-2 bg-s2">
        <ImageIcon size={28} className="text-label-3" />
        <span className="text-[12px] text-label-3">图片预览 · {file.size}</span>
      </div>
    );
  }
  if (file.kind === "pdf") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex h-9 items-center gap-2 rounded-md border border-line-1 bg-s2 px-3 text-[11.5px] text-label-3">
          <FileText size={13} /> PDF · 3 页 · {file.size}
        </div>
        <div className="mx-auto w-full max-w-[300px] rounded-md border border-line-1 bg-white p-5 shadow-[0_4px_16px_rgb(15_17_21_/_8%)]">
          <p className="text-[13px] font-semibold">项目规格说明</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {[100, 92, 84, 96, 60].map((w, i) => (
              <span key={i} className="block h-1.5 rounded bg-s3" style={{ width: `${w}%` }} />
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] text-label-3">第 1 / 3 页</p>
        </div>
      </div>
    );
  }
  if (file.kind === "docx") {
    return (
      <div className="rounded-md border border-line-1 bg-white p-5 shadow-[0_4px_16px_rgb(15_17_21_/_8%)]">
        <p className="text-[14px] font-semibold text-label-1">合作提案</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-label-2">
          本提案概述下一阶段的工作范围、里程碑与验收标准。文档由写作类智能体生成，
          支持 Word 编辑与批注。
        </p>
        <ul className="mt-2 list-disc pl-5 text-[12.5px] text-label-2">
          <li>里程碑一：菜单 IA 定稿</li>
          <li>里程碑二：智能体运行时管理</li>
          <li>里程碑三：工作区与面板</li>
        </ul>
      </div>
    );
  }
  return <pre className="whitespace-pre-wrap rounded-md border border-line-1 bg-s2 p-3 font-mono text-[11.5px] leading-relaxed text-label-2">{file.content ?? ""}</pre>;
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-[15px] font-semibold">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-[13px] font-semibold">{line.slice(3)}</h2>;
        if (line.startsWith("- ")) return <p key={i} className="pl-3 text-[12.5px] text-label-2">• {line.slice(2)}</p>;
        if (!line.trim()) return null;
        return <p key={i} className="text-[12.5px] leading-relaxed text-label-2">{line}</p>;
      })}
    </div>
  );
}

function CsvTable({ text }: { text: string }) {
  const rows = text.trim().split("\n").map((r) => r.split(","));
  const [head, ...body] = rows;
  return (
    <table className="w-full text-[11.5px]">
      <thead>
        <tr className="border-b border-line-1 bg-s2 text-label-3">
          {head.map((h) => (
            <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((r, i) => (
          <tr key={i} className="border-b border-line-1 last:border-0 font-mono text-label-2">
            {r.map((c, j) => (
              <td key={j} className="px-2 py-1">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
