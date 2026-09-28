import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import DetailsPanel, { type DetailsTab } from "./DetailsPanel";
import { DetailsProvider } from "./details-context";
import { useMediaQuery } from "./useMediaQuery";
import { t } from "../i18n";
import { Icon } from "../ui/icons";

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
  /** 点击通知项：跳转到对应会话。 */
  onOpenNotifications?: (sessionId: string | null) => void;
  /** 点击品牌行核心灯：打开系统升级。 */
  onOpenSystem?: () => void;
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
  list,
  onOpenNotifications,
  onOpenSystem,
  children,
}: AppShellProps) {
  const narrow = useMediaQuery("(max-width: 900px)");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("files");
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // 离开窄屏时收起抽屉，回到三栏。
  useEffect(() => {
    if (!narrow) {
      setDrawerOpen(false);
    }
  }, [narrow]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    [],
  );

  const toggleSidebar = useCallback(() => {
    if (narrow) {
      setDrawerOpen((value) => !value);
    } else {
      setCollapsed((value) => !value);
    }
  }, [narrow]);

  const detailsValue = useMemo(
    () => ({
      open: detailsOpen,
      toggle: () => setDetailsOpen((value) => !value),
      close: () => setDetailsOpen(false),
    }),
    [detailsOpen],
  );

  return (
    <DetailsProvider value={detailsValue}>
      <div className="app-shell" data-narrow={narrow}>
        {narrow && drawerOpen ? (
          <div
            className="sidebar-backdrop"
            role="presentation"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        <Sidebar
          active={active}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onToggleCollapse={toggleSidebar}
          mobile={narrow}
          drawerOpen={drawerOpen}
          isSuperAdmin={isSuperAdmin}
          version={version}
          coreOnline={coreOnline}
          channelOnline={channelOnline}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenNotifications={onOpenNotifications}
          onOpenSystem={onOpenSystem}
        >
          {list}
        </Sidebar>

        <div className="main">
          {narrow ? (
            <button
              type="button"
              className="icon-btn sidebar-fab"
              aria-label={drawerOpen ? t("sidebar.closeNav") : t("sidebar.openNav")}
              aria-expanded={drawerOpen}
              onClick={toggleSidebar}
            >
              <Icon name={drawerOpen ? "close" : "menu"} />
            </button>
          ) : null}
          <div className="main-body">{children}</div>
        </div>

        {detailsOpen ? (
          <DetailsPanel tab={detailsTab} onTabChange={setDetailsTab} onClose={() => setDetailsOpen(false)} />
        ) : null}
      </div>
    </DetailsProvider>
  );
}
