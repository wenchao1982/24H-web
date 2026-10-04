import { useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Brain,
  CalendarClock,
  ChevronDown,
  ChevronsLeft,
  FileText,
  FolderTree,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  SquareKanban,
  Sun,
  User,
  Users,
  Workflow,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { NOTIFICATIONS, SESSIONS } from "../mocks/data";
import type { SessionSummary } from "../mocks/types";
import { cn } from "../lib/cn";
import { Logo } from "./Logo";

export type ScreenId =
  | "login"
  | "chat-hero"
  | "chat-docked"
  | "agents"
  | "groups"
  | "tasks"
  | "kanban"
  | "orchestration"
  | "usage"
  | "monitor"
  | "skills-ui"
  | "tools"
  | "memory"
  | "projects"
  | "files"
  | "settings"
  | "admin"
  | "account"
  | "notifications";

interface NavItem {
  id: ScreenId;
  label: string;
  icon: ComponentType<LucideProps>;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/** 分组式一级导航（对齐 Hermes 功能域）。 */
const GROUPS: NavGroup[] = [
  {
    id: "workbench",
    label: "工作台",
    items: [
      { id: "chat-hero", label: "对话", icon: MessageSquare },
      { id: "groups", label: "群聊", icon: Users },
      { id: "tasks", label: "任务", icon: CalendarClock },
      { id: "kanban", label: "看板", icon: SquareKanban },
    ],
  },
  {
    id: "agent",
    label: "智能体",
    items: [{ id: "agents", label: "智能体", icon: Bot }],
  },
  {
    id: "orchestration",
    label: "编排",
    items: [{ id: "orchestration", label: "编排", icon: Workflow }],
  },
  {
    id: "insight",
    label: "洞察",
    items: [
      { id: "usage", label: "用量", icon: BarChart3 },
      { id: "monitor", label: "监控", icon: Activity },
      { id: "memory", label: "记忆", icon: Brain },
    ],
  },
  {
    id: "workspace",
    label: "工作区",
    items: [
      { id: "projects", label: "项目", icon: FolderTree },
      { id: "files", label: "文件", icon: FileText },
    ],
  },
];

const BOTTOM: NavItem[] = [
  { id: "settings", label: "设置", icon: Settings },
  { id: "admin", label: "管理", icon: Shield },
  { id: "account", label: "账户", icon: User },
];

const ALL_ITEMS = [...GROUPS.flatMap((g) => g.items), ...BOTTOM];

export interface SidebarProps {
  active: ScreenId;
  onNavigate: (id: ScreenId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

/** 对话区（hero/docked）共用「对话」导航高亮。 */
function isActive(itemId: ScreenId, active: ScreenId): boolean {
  if (itemId === "chat-hero") {
    return active === "chat-hero" || active === "chat-docked";
  }
  return itemId === active;
}

function groupHasActive(group: NavGroup, active: ScreenId): boolean {
  return group.items.some((item) => isActive(item.id, active));
}

export function Sidebar({
  active,
  onNavigate,
  collapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;
  const showSessions = active === "chat-hero" || active === "chat-docked";

  if (collapsed) {
    return (
      <aside className="thin-scroll flex h-full w-[56px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line-1 bg-s2 py-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-s3"
          aria-label="展开侧栏"
        >
          <Logo size={22} />
        </button>
        {ALL_ITEMS.map((item) => (
          <RailButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isActive(item.id, active)}
            onClick={() => onNavigate(item.id)}
          />
        ))}
        <button
          type="button"
          onClick={onToggleTheme}
          title="主题"
          aria-label="主题"
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-md text-label-2 hover:bg-s3"
        >
          {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-line-1 bg-s2">
      {/* 品牌行 */}
      <div className="flex h-12 items-center gap-2 px-3">
        <Logo size={22} />
        <span className="text-[14px] font-semibold tracking-tight">24H</span>
        <span className="rounded-pill border border-line-1 px-1.5 py-px font-mono text-[10px] text-label-3">
          v0.21.3
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <StatusDot on label="核心" />
          <StatusDot on label="渠道" />
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-md text-label-3 hover:bg-s3 hover:text-label-1"
            aria-label="收起侧栏"
          >
            <ChevronsLeft size={16} />
          </button>
        </div>
      </div>

      {/* 新建会话 */}
      <div className="px-3 pb-1">
        <button
          type="button"
          onClick={() => onNavigate("chat-hero")}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-line-1 bg-s1 px-3 text-[13px] font-medium text-label-1 shadow-[0_1px_2px_rgb(15_17_21_/_5%)] transition-colors hover:bg-s2"
        >
          <Plus size={16} className="text-label-2" />
          新建会话
        </button>
      </div>

      {/* 分组导航 + 上下文列表 */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {GROUPS.map((group) => {
          const isClosed = closed[group.id] ?? false;
          const hasActive = groupHasActive(group, active);
          return (
            <section key={group.id} className="mt-2">
              <button
                type="button"
                onClick={() => setClosed((c) => ({ ...c, [group.id]: !isClosed }))}
                aria-expanded={!isClosed}
                className="flex h-7 w-full items-center gap-1 rounded-md bg-transparent px-1.5 text-label-3 transition-colors hover:bg-s3/60 hover:text-label-1"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  {group.label}
                </span>
                {isClosed && hasActive ? (
                  <i className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                ) : null}
                <ChevronDown
                  size={13}
                  className={cn("ml-auto transition-transform", isClosed && "-rotate-90")}
                />
              </button>
              {!isClosed ? (
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavRow
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      navId={item.id}
                      active={isActive(item.id, active)}
                      onClick={() => onNavigate(item.id)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        {showSessions ? (
          <section className="mt-3">
            <div className="flex h-7 items-center justify-between px-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-label-3">
                会话
              </span>
              <span className="flex items-center gap-1 text-label-3">
                <button type="button" className="rounded p-0.5 hover:bg-s3 hover:text-label-1" aria-label="搜索会话">
                  <Search size={13} />
                </button>
                <button type="button" className="rounded p-0.5 hover:bg-s3 hover:text-label-1" aria-label="会话筛选">
                  <SlidersHorizontal size={13} />
                </button>
              </span>
            </div>
            <div className="mt-0.5">
              {SESSIONS.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* 底部固定 */}
      <div className="border-t border-line-1 p-2">
        {BOTTOM.map((item) => (
          <NavRow
            key={item.id}
            icon={item.icon}
            label={item.label}
            navId={item.id}
            active={isActive(item.id, active)}
            onClick={() => onNavigate(item.id)}
          />
        ))}
        <button
          type="button"
          data-demo-nav="notifications"
          onClick={() => onNavigate("notifications")}
          className={cn(
            "relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
            active === "notifications"
              ? "bg-accent-weak font-medium text-accent"
              : "text-label-2 hover:bg-s3 hover:text-label-1",
          )}
        >
          <Bell size={17} className={active === "notifications" ? "text-accent" : "text-label-3"} />
          通知
          {unread > 0 ? (
            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          ) : null}
        </button>
        <NavRow
          icon={theme === "dark" ? Moon : Sun}
          label={theme === "dark" ? "深色" : "浅色"}
          active={false}
          onClick={onToggleTheme}
        />
      </div>
    </aside>
  );
}

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
        active ? "bg-accent-weak text-accent" : "text-label-2 hover:bg-s3",
      )}
    >
      <Icon size={18} />
    </button>
  );
}

function NavRow({
  icon: Icon,
  label,
  active,
  navId,
  onClick,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  active: boolean;
  navId?: ScreenId;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      data-demo-nav={navId}
      onClick={onClick}
      className={cn(
        "relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
        active ? "bg-accent-weak font-medium text-accent" : "text-label-2 hover:bg-s3 hover:text-label-1",
      )}
    >
      {active ? (
        <i className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" aria-hidden="true" />
      ) : null}
      <Icon size={17} className={active ? "text-accent" : "text-label-3"} />
      {label}
    </button>
  );
}

function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-label-3" title={label}>
      <i
        className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-success" : "bg-label-3")}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  return (
    <button
      type="button"
      className="group flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-s3"
    >
      <span className="flex items-center gap-1.5">
        {session.pending ? (
          <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
        ) : null}
        {session.running ? (
          <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        ) : null}
        <span className="truncate text-[13px] text-label-1">{session.title}</span>
      </span>
      <span className="truncate pl-0 text-[11px] text-label-3">{session.updatedAt}</span>
    </button>
  );
}
