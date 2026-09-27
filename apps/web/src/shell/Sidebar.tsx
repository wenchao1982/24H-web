import type { ReactNode } from "react";
import { t } from "../i18n";
import NotificationsBell from "../notifications/NotificationsBell";
import { BOTTOM_NAV, PRIMARY_NAV, type NavItem } from "./nav";

export interface SidebarProps {
  active?: string;
  onNavigate?: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** 窄屏抽屉模式。 */
  mobile?: boolean;
  drawerOpen?: boolean;
  isSuperAdmin?: boolean;
  version?: string;
  coreOnline?: boolean;
  channelOnline?: boolean;
  /** 上下文列表（随当前区切换）。 */
  children?: ReactNode;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  /** 通知项点击：跳转到对应会话。 */
  onOpenNotifications?: (sessionId: string | null) => void;
  /** 点击品牌行核心灯：打开系统升级。 */
  onOpenSystem?: () => void;
}

function visibleBottom(isSuperAdmin: boolean): NavItem[] {
  return BOTTOM_NAV.filter((item) => !item.superAdminOnly || isSuperAdmin);
}

export default function Sidebar({
  active,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  mobile = false,
  drawerOpen = false,
  isSuperAdmin = false,
  version,
  coreOnline = true,
  channelOnline = true,
  children,
  theme = "light",
  onToggleTheme,
  onOpenNotifications,
  onOpenSystem,
}: SidebarProps) {
  return (
    <nav
      className="sidebar"
      data-collapsed={collapsed}
      data-mobile={mobile}
      data-drawer={mobile ? (drawerOpen ? "open" : "closed") : undefined}
      aria-label={t("sidebar.aria")}
    >
      <div className="brand">
        <span className="brand-mark">{t("sidebar.brand")}</span>
        {version ? <span className="brand-version">{version}</span> : null}
        <button
          type="button"
          className="brand-status brand-core"
          title={coreOnline ? t("sidebar.coreOnline") : t("sidebar.coreOffline")}
          aria-label={t("sidebar.openSystem")}
          onClick={onOpenSystem}
        >
          <i className="dot" data-on={coreOnline} aria-hidden="true" />
          {t("sidebar.core")}
        </button>
        <span
          className="brand-status"
          title={channelOnline ? t("sidebar.channelOnline") : t("sidebar.channelOffline")}
        >
          <i className="dot" data-on={channelOnline} aria-hidden="true" />
          {t("sidebar.channel")}
        </span>
        {mobile ? null : (
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
            onClick={onToggleCollapse}
          >
            {collapsed ? "»" : "«"}
          </button>
        )}
      </div>

      <ul className="nav-primary">
        {PRIMARY_NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="nav-btn"
              data-active={active === item.id}
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => onNavigate?.(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{t(item.labelKey)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-list">{children}</div>

      <div className="sidebar-footer">
        {visibleBottom(isSuperAdmin).map((item) => (
          <button
            key={item.id}
            type="button"
            className="nav-btn"
            data-active={active === item.id}
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => onNavigate?.(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-label">{t(item.labelKey)}</span>
          </button>
        ))}
        <NotificationsBell onSelect={onOpenNotifications} />
        <button
          type="button"
          className="nav-btn theme-toggle"
          aria-label={t("sidebar.theme.toggle")}
          onClick={onToggleTheme}
        >
          <span className="nav-icon" aria-hidden="true">
            {theme === "dark" ? "☾" : "☀"}
          </span>
          <span className="nav-label">
            {theme === "dark" ? t("sidebar.theme.dark") : t("sidebar.theme.light")}
          </span>
        </button>
      </div>
    </nav>
  );
}
