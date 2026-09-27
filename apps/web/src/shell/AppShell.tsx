import { useCallback, useEffect, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import DetailsPanel, { type DetailsTab } from "./DetailsPanel";
import { t } from "../i18n";

export interface AppShellProps {
  active?: string;
  onNavigate?: (id: string) => void;
  isSuperAdmin?: boolean;
  version?: string;
  coreOnline?: boolean;
  channelOnline?: boolean;
  title?: string;
  /** 侧栏上下文列表。 */
  list?: ReactNode;
  children?: ReactNode;
}

type Theme = "light" | "dark";

function initialTheme(): Theme {
  if (typeof document === "undefined") {
    return "light";
  }
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function AppShell({
  active,
  onNavigate,
  isSuperAdmin = false,
  version,
  coreOnline = true,
  channelOnline = true,
  title,
  list,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("files");
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // 让步链：窄屏自动把侧栏折叠为 56px 轨道。
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => {
      if (mq.matches) {
        setCollapsed(true);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    [],
  );

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        isSuperAdmin={isSuperAdmin}
        version={version}
        coreOnline={coreOnline}
        channelOnline={channelOnline}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        {list}
      </Sidebar>

      <div className="main">
        <header className="main-header">
          <h1 className="main-title">{title}</h1>
          <div className="main-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={detailsOpen ? t("shell.closeDetails") : t("shell.openDetails")}
              aria-pressed={detailsOpen}
              onClick={() => setDetailsOpen((value) => !value)}
            >
              ◧
            </button>
          </div>
        </header>
        <div className="main-body">{children}</div>
      </div>

      {detailsOpen ? (
        <DetailsPanel tab={detailsTab} onTabChange={setDetailsTab} onClose={() => setDetailsOpen(false)} />
      ) : null}
    </div>
  );
}
