import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
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

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 420;
  const DETAILS_MIN = 260;
  const DETAILS_MAX = 640;
  const MAIN_MIN = 420;
  const DETAILS_RESTORE = 320;
  const SIDEBAR_RAIL = 56;

  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [detailsWidth, setDetailsWidth] = useState(340);
  const [dragging, setDragging] = useState<"sidebar" | "details" | null>(null);
  const detailsPrefRef = useRef(340);
  const detailsAutoClosedRef = useRef(false);
  const dragRef = useRef<{ kind: "sidebar" | "details"; startX: number; startWidth: number } | null>(
    null,
  );

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

  // 拖拽中禁止选中文本。
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.body.style.userSelect = dragging ? "none" : "";
    return () => {
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  // 让步链：窗口变窄先收缩详情，仍不足则自动关闭；回宽自动恢复。
  // 注意：仅在 resize 事件中执行，挂载时不运行（避免测试环境 innerWidth 影响初始渲染）。
  useEffect(() => {
    if (narrow) {
      return;
    }
    const onResize = () => {
      const room = window.innerWidth - (collapsed ? SIDEBAR_RAIL : sidebarWidth);
      if (detailsOpen) {
        const maxFit = room - MAIN_MIN;
        if (maxFit < DETAILS_MIN) {
          detailsAutoClosedRef.current = true;
          setDetailsOpen(false);
        } else {
          setDetailsWidth(clamp(Math.min(detailsPrefRef.current, maxFit), DETAILS_MIN, DETAILS_MAX));
        }
      } else if (detailsAutoClosedRef.current && room >= MAIN_MIN + DETAILS_RESTORE) {
        detailsAutoClosedRef.current = false;
        setDetailsWidth(detailsPrefRef.current);
        setDetailsOpen(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [narrow, collapsed, sidebarWidth, detailsOpen]);

  const startDrag = (kind: "sidebar" | "details", e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      kind,
      startX: e.clientX,
      startWidth: kind === "sidebar" ? sidebarWidth : detailsWidth,
    };
    setDragging(kind);
    e.preventDefault();
  };

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const dx = e.clientX - drag.startX;
    if (drag.kind === "sidebar") {
      setSidebarWidth(clamp(drag.startWidth + dx, SIDEBAR_MIN, SIDEBAR_MAX));
    } else {
      const width = clamp(drag.startWidth - dx, DETAILS_MIN, DETAILS_MAX);
      setDetailsWidth(width);
      detailsPrefRef.current = width;
    }
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setDragging(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // 指针未被捕获时忽略。
    }
  };

  const detailsValue = useMemo(
    () => ({
      open: detailsOpen,
      toggle: () =>
        setDetailsOpen((value) => {
          detailsAutoClosedRef.current = false;
          return !value;
        }),
      close: () => {
        detailsAutoClosedRef.current = false;
        setDetailsOpen(false);
      },
    }),
    [detailsOpen],
  );

  return (
    <DetailsProvider value={detailsValue}>
      <div
        className="app-shell"
        data-narrow={narrow}
        style={
          {
            "--ds-sidebar-width": `${sidebarWidth}px`,
            "--ds-details-width": `${detailsWidth}px`,
          } as CSSProperties
        }
      >
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

        {!collapsed && !narrow ? (
          <div
            className="resize-handle resize-handle--sidebar"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整侧栏宽度"
            data-dragging={dragging === "sidebar"}
            onPointerDown={(e) => startDrag("sidebar", e)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ) : null}

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
          <main className="main-body">{children}</main>
        </div>

        {detailsOpen ? (
          <>
            {!narrow ? (
              <div
                className="resize-handle resize-handle--details"
                role="separator"
                aria-orientation="vertical"
                aria-label="调整详情面板宽度"
                data-dragging={dragging === "details"}
                onPointerDown={(e) => startDrag("details", e)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ) : null}
            <DetailsPanel tab={detailsTab} onTabChange={setDetailsTab} onClose={detailsValue.close} />
          </>
        ) : null}
      </div>
    </DetailsProvider>
  );
}
