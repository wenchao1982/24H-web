import { useState } from "react";
import {
  Check,
  Download,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  AGENT_CATALOG,
  HERMES_PROFILES,
  NATIVE_AGENTS,
} from "../mocks/data";
import type { NativeAgent } from "../mocks/types";
import { cn } from "../lib/cn";

type Selection = { kind: "profile" | "runtime"; id: string };

const VENDOR: Record<string, string> = {
  "claude-code": "Anthropic",
  codex: "OpenAI",
  opencode: "OpenCode",
  pi: "Pi",
  grok: "xAI",
  "gemini-cli": "Google",
  aider: "Aider",
  "cursor-agent": "Cursor",
  amp: "Sourcegraph",
};

const PROFILE_TABS = ["SOUL", "技能", "工具", "MCP", "插件", "Bot 屏幕"] as const;
const RUNTIME_TABS = ["概览", "外部会话", "配置"] as const;

/** 智能体（方案 C 混合）：Hermes 分组（=profile）+ 外部 agent 分组（原生安装）。 */
export function AgentManager() {
  const [selection, setSelection] = useState<Selection>({ kind: "profile", id: HERMES_PROFILES[0].id });
  const [runtimes, setRuntimes] = useState<NativeAgent[]>(
    NATIVE_AGENTS.filter((a) => a.id !== "hermes"),
  );
  const [installOpen, setInstallOpen] = useState(false);
  const [tab, setTab] = useState<string>("SOUL");

  const profile = HERMES_PROFILES.find((p) => p.id === selection.id);
  const runtime = runtimes.find((r) => r.id === selection.id);

  const select = (next: Selection) => {
    setSelection(next);
    setTab(next.kind === "profile" ? "SOUL" : "概览");
  };

  const uninstall = (id: string) => {
    setRuntimes((list) => list.filter((r) => r.id !== id));
    setSelection({ kind: "profile", id: HERMES_PROFILES[0].id });
  };

  const install = (runtimeId: string) => {
    const entry = AGENT_CATALOG.find((c) => c.runtime === runtimeId);
    if (!entry || runtimes.some((r) => r.id === runtimeId)) return;
    const created: NativeAgent = {
      id: runtimeId,
      name: entry.name,
      avatar: entry.name.slice(0, 1).toUpperCase(),
      runtime: runtimeId,
      description: entry.description,
      strengths: ["通用"],
      version: "0.1.0",
      status: "ready",
      binaryPath: `~/.24h/agents/bin/${runtimeId}`,
      model: null,
      skills: [],
      mcpServers: [],
      toolsets: ["terminal"],
    };
    setRuntimes((list) => [...list, created]);
    setInstallOpen(false);
    select({ kind: "runtime", id: runtimeId });
  };

  return (
    <div className="flex h-full min-h-0">
      {/* 左列表：分组 */}
      <div className="flex w-[320px] shrink-0 flex-col border-r border-line-1">
        <div className="flex h-12 items-center gap-2 px-3">
          <h1 className="text-[14px] font-medium">智能体</h1>
          <button
            type="button"
            onClick={() => setInstallOpen(true)}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white hover:bg-accent-strong"
          >
            <Plus size={14} /> 安装外部 agent
          </button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {/* Hermes 分组 */}
          <p className="px-1.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-label-3">
            Hermes · profile
          </p>
          {HERMES_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select({ kind: "profile", id: p.id })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                selection.kind === "profile" && selection.id === p.id ? "bg-accent-weak" : "hover:bg-s3",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold",
                  selection.kind === "profile" && selection.id === p.id ? "bg-accent text-white" : "bg-s3 text-label-2",
                )}
              >
                {p.avatar}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-label-1">{p.name}</span>
                  {p.isDefault ? (
                    <span className="rounded-pill bg-s3 px-1.5 text-[9px] text-label-3">默认</span>
                  ) : null}
                </span>
                <span className="truncate font-mono text-[11px] text-label-3">{p.model}</span>
              </span>
            </button>
          ))}

          {/* 外部 agent 分组 */}
          <p className="px-1.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-label-3">
            外部 agent
          </p>
          {runtimes.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => select({ kind: "runtime", id: r.id })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                selection.kind === "runtime" && selection.id === r.id ? "bg-accent-weak" : "hover:bg-s3",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold",
                  selection.kind === "runtime" && selection.id === r.id ? "bg-accent text-white" : "bg-s3 text-label-2",
                )}
              >
                {r.avatar}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-label-1">{r.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <i
                    className={cn("h-1.5 w-1.5 rounded-full", r.status === "ready" ? "bg-success" : r.status === "update-available" ? "bg-warning" : "bg-label-3")}
                    aria-hidden="true"
                  />
                  <span className="truncate font-mono text-[11px] text-label-3">{r.version}</span>
                  {r.status === "update-available" ? <span className="text-[10px] text-warning">可更新</span> : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 右详情 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selection.kind === "profile" && profile ? (
          <ProfileDetail profile={profile} tab={tab} setTab={setTab} />
        ) : runtime ? (
          <RuntimeDetail
            runtime={runtime}
            tab={tab}
            setTab={setTab}
            onUpdate={() =>
              setRuntimes((list) =>
                list.map((r) =>
                  r.id === runtime.id ? { ...r, version: r.latestVersion ?? r.version, latestVersion: undefined, status: "ready" } : r,
                ),
              )
            }
            onUninstall={() => uninstall(runtime.id)}
          />
        ) : null}
      </div>

      {installOpen ? <InstallModal installed={runtimes.map((r) => r.runtime)} onInstall={install} onClose={() => setInstallOpen(false)} /> : null}
    </div>
  );
}

function ProfileDetail({
  profile,
  tab,
  setTab,
}: {
  profile: (typeof HERMES_PROFILES)[number];
  tab: string;
  setTab: (t: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-line-1 px-6 py-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-weak text-[17px] font-semibold text-accent">
          {profile.avatar}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[16px] font-semibold">{profile.name}</h2>
            {profile.isDefault ? <span className="rounded-pill bg-s3 px-2 py-0.5 text-[10px] text-label-3">默认 profile</span> : null}
            <span className="rounded-pill border border-line-1 px-2 py-0.5 font-mono text-[10px] text-label-3">{profile.version}</span>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-label-3">
            模型 {profile.model} · {profile.skills.length} 技能 · {profile.mcp.length} MCP
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">克隆</button>
          <button type="button" className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">导出</button>
          <button type="button" className="h-8 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong">编辑</button>
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-line-1 px-6">
        {PROFILE_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 px-2.5 py-2.5 text-[13px] transition-colors", tab === t ? "border-accent font-medium text-accent" : "border-transparent text-label-2 hover:text-label-1")}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-[640px]">
          {tab === "SOUL" ? (
            <div className="rounded-lg border border-line-1 bg-s1 p-4 text-[13px] leading-relaxed text-label-1">{profile.soul}</div>
          ) : (
            <ChipList items={(tab === "技能" ? profile.skills : tab === "MCP" ? profile.mcp : tab === "工具" ? profile.toolsets : tab === "插件" ? ["browser-helper", "sql-tools"] : ["桌面屏幕镜像（Xvnc）"]).map((n) => n)} />
          )}
        </div>
      </div>
    </>
  );
}

function RuntimeDetail({
  runtime,
  tab,
  setTab,
  onUpdate,
  onUninstall,
}: {
  runtime: NativeAgent;
  tab: string;
  setTab: (t: string) => void;
  onUpdate: () => void;
  onUninstall: () => void;
}) {
  const [auto, setAuto] = useState(runtime.status !== "stopped");
  return (
    <>
      <div className="flex items-start gap-3 border-b border-line-1 px-6 py-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-s3 text-[17px] font-semibold text-label-2">
          {runtime.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[16px] font-semibold">{runtime.name}</h2>
            <span className="rounded-pill border border-line-1 px-2 py-0.5 text-[10px] text-label-3">{VENDOR[runtime.runtime] ?? runtime.runtime}</span>
            <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <Check size={11} /> Installed
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-label-3">{runtime.description}</p>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-label-3">
            <span className="font-mono">v{runtime.version.replace(/^v/, "")}</span>
            {runtime.latestVersion ? <span className="text-warning">→ {runtime.latestVersion} 可更新</span> : null}
            <span className="font-mono">{runtime.binaryPath}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">Settings</button>
          <button type="button" onClick={onUpdate} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">
            <RefreshCw size={14} /> Check for update
          </button>
          <button type="button" onClick={onUninstall} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-danger/30 px-3 text-[12.5px] text-danger hover:bg-s2">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-line-1 px-6">
        {RUNTIME_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 px-2.5 py-2.5 text-[13px] transition-colors", tab === t ? "border-accent font-medium text-accent" : "border-transparent text-label-2 hover:text-label-1")}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-[640px]">
          {tab === "概览" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <Field label="运行时" value={runtime.runtime} mono />
                <Field label="版本" value={runtime.version} mono />
                <Field label="安装路径" value={runtime.binaryPath} mono />
                <Field label="安装方式" value="npm -g --prefix（受管）" />
              </div>
              <section className="flex items-center justify-between rounded-lg border border-line-1 bg-s1 p-4">
                <span>
                  <span className="block text-[13px] font-medium">Automatic updates</span>
                  <span className="block text-[11px] text-label-3">空闲 60s 自动检查并更新（运行中跳过）</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAuto((v) => !v)}
                  aria-label="自动更新"
                  className={cn("flex h-6 w-11 items-center rounded-pill px-0.5 transition-colors", auto ? "justify-end bg-accent" : "bg-s3")}
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </section>
              <p className="text-[11px] text-label-3">
                外部 agent 由 BFF `coding-agents` 在主安装/管理；技能/MCP/工具只在 Hermes agent（profile）生效。
              </p>
            </div>
          ) : tab === "外部会话" ? (
            <div className="flex flex-col gap-1.5">
              {[
                { title: "重构 coding-agents 模块", at: "2 小时前" },
                { title: "排查 pnpm PATH", at: "昨天" },
              ].map((s) => (
                <div key={s.title} className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-label-1">{s.title}</span>
                  <span className="text-[11px] text-label-3">{s.at}</span>
                  <button type="button" className="h-7 rounded-md border border-line-1 px-2.5 text-[12px] text-label-2 hover:bg-s2">导入</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-line-1 bg-s1 p-4 font-mono text-[12px] leading-relaxed text-label-2">
              <p># {runtime.runtime} 配置（只读展示 / 编辑交各 agent）</p>
              <p>api_base = "https://api.example.com/v1"</p>
              <p>model = "auto"</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((n) => (
        <span key={n} className="inline-flex items-center gap-1 rounded-pill bg-s3 px-2.5 py-1 font-mono text-[12px] text-label-2">
          <Wrench size={12} className="text-label-3" /> {n}
        </span>
      ))}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-line-1 bg-s1 px-3 py-2">
      <p className="text-[11px] text-label-3">{label}</p>
      <p className={cn("mt-0.5 text-[13px] text-label-1", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function InstallModal({
  installed,
  onInstall,
  onClose,
}: {
  installed: string[];
  onInstall: (runtime: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(15_17_21_/_45%)]" onClick={onClose}>
      <div className="w-[560px] max-w-[90%] rounded-lg border border-line-1 bg-s1 shadow-[0_8px_24px_rgb(15_17_21_/_16%)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line-1 px-4 py-3">
          <Store size={16} className="text-label-3" />
          <span className="text-[14px] font-medium">安装外部 agent</span>
          <span className="text-[11px] text-label-3">（BFF 原生安装 · super_admin）</span>
          <button type="button" onClick={onClose} className="ml-auto text-[12px] text-label-3 hover:text-label-1">关闭</button>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto p-3">
          {AGENT_CATALOG.map((c) => {
            const isInstalled = installed.includes(c.runtime);
            return (
              <div key={c.runtime} className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3.5 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-s3 text-[12px] font-semibold text-label-2">
                  {c.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-label-1">
                    {c.name} <span className="text-[11px] font-normal text-label-3">{VENDOR[c.runtime] ?? ""}</span>
                  </span>
                  <span className="block truncate text-[12px] text-label-3">{c.description}</span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-label-3">{c.install}</span>
                </span>
                {isInstalled ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-success"><Check size={12} /> 已安装</span>
                ) : (
                  <button type="button" onClick={() => onInstall(c.runtime)} className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white hover:bg-accent-strong">
                    <Download size={12} /> 安装
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
