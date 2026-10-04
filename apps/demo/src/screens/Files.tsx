import { useState } from "react";
import { ChevronRight, File as FileIcon, FileText, Folder } from "lucide-react";
import { cn } from "../lib/cn";

interface Node {
  name: string;
  depth: number;
  kind: "folder" | "file";
  active?: boolean;
}

const TREE: Node[] = [
  { name: "apps", depth: 0, kind: "folder" },
  { name: "demo", depth: 1, kind: "folder" },
  { name: "src", depth: 2, kind: "folder" },
  { name: "App.tsx", depth: 3, kind: "file" },
  { name: "styles.css", depth: 3, kind: "file", active: true },
  { name: "package.json", depth: 2, kind: "file" },
  { name: "server", depth: 1, kind: "folder" },
  { name: "docs", depth: 0, kind: "folder" },
  { name: "INTERFACES.md", depth: 1, kind: "file" },
  { name: "README.md", depth: 0, kind: "file" },
];

const CONTENT = `/* 24H Web 设计 token —— 唯一的字面颜色定义处 */
:root {
  --ds-bg-base: #ffffff;
  --ds-surface-l1: #ffffff;
  --ds-surface-l2: #f7f8fa;
  --ds-label-primary: #0f1115;
  --ds-label-secondary: #61666b;
  --ds-border-l1: rgb(0 0 0 / 10%);
  --ds-accent: #4d6bfe;
  --ds-radius-md: 10px;
  --ds-radius-lg: 16px;
}

[data-theme="dark"] {
  --ds-bg-base: #151517;
  --ds-surface-l1: #1c1c1f;
  --ds-accent: #4d6bfe;
}`;

const TABS = ["文件", "Git", "日志"] as const;

/** 文件：工作区文件树 + 内容预览（对应 L2 /api/files + /api/git + /api/logs）。 */
export function Files() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("文件");

  return (
    <div className="flex h-full min-h-0">
      {/* 文件树 */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-line-1">
        <div className="flex h-12 items-center gap-2 border-b border-line-1 px-4">
          <h1 className="text-[14px] font-medium">文件</h1>
          <span className="truncate font-mono text-[11px] text-label-3">/work/24h-web</span>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto py-2">
          {TREE.map((node) => (
            <button
              key={`${node.depth}-${node.name}`}
              type="button"
              className={cn(
                "flex h-7 w-full items-center gap-1.5 pr-2 text-left text-[12.5px] transition-colors hover:bg-s3",
                node.active ? "bg-accent-weak text-accent" : "text-label-2",
              )}
              style={{ paddingLeft: 12 + node.depth * 14 }}
            >
              {node.kind === "folder" ? (
                <ChevronRight size={12} className="text-label-3" />
              ) : (
                <span className="w-3" />
              )}
              {node.kind === "folder" ? (
                <Folder size={14} className="text-label-3" />
              ) : (
                <FileIcon size={14} className="text-label-3" />
              )}
              <span className={cn("truncate", node.active && "font-medium")}>{node.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 预览 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line-1 px-4">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12.5px] transition-colors",
                tab === t ? "bg-accent-weak font-medium text-accent" : "text-label-2 hover:bg-s2",
              )}
            >
              {t}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[12px] text-label-3">
            <FileText size={13} /> styles.css
          </span>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-auto bg-s1 p-4">
          {tab === "文件" ? (
            <pre className="font-mono text-[12.5px] leading-relaxed text-label-2">{CONTENT}</pre>
          ) : tab === "Git" ? (
            <div className="flex flex-col gap-1.5 font-mono text-[12.5px]">
              <p className="text-success">M  apps/web/src/styles.css</p>
              <p className="text-success">M  apps/web/src/ui/icons.tsx</p>
              <p className="text-label-3">?? docs/refs/demo-*.png</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 font-mono text-[12px] text-label-2">
              <p>[info] ws proxy ready</p>
              <p>[info] request session.list (profile=default)</p>
              <p className="text-warning">[warn] profile fallback applied</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
