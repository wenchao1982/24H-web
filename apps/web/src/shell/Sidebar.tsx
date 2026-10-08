import { useState, type ReactNode } from "react";
import { t } from "../i18n";
import NotificationsBell from "../notifications/NotificationsBell";
import { BrandMark, Icon } from "../ui/icons";
import { BOTTOM_NAV, NAV_GROUPS, type NavItem } from "./nav";

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
  /** 「新建会话」（导航到对话并触发新会话）。 */
  onNewSession?: () => void;
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
  onNewSession,
}: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = (id: string) =>
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  return (
    <nav
      className="sidebar"
      data-collapsed={collapsed}
      data-mobile={mobile}
      data-drawer={mobile ? (drawerOpen ? "open" : "closed") : undefined}
      aria-label={t("sidebar.aria")}
    >
      <div className="brand">
        <BrandMark size={22} />
        <span className="brand-name">{t("sidebar.brand")}</span>
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
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} />
          </button>
        )}
      </div>

      <button type="button" className="sidebar-new" onClick={onNewSession}>
        <Icon name="plus" size={16} />
        <span className="nav-label">{t("sidebar.newSession")}</span>
      </button>

      <div className="nav-primary" aria-label={t("sidebar.nav.primary")}>
        {NAV_GROUPS.map((group) => {
          const collapsedGroup = collapsedGroups.has(group.id);
          return (
            <div className="nav-group" key={group.id}>
              <button
                type="button"
                className="nav-group-title"
                aria-expanded={!collapsedGroup}
                onClick={() => toggleGroup(group.id)}
              >
                <span>{t(group.labelKey)}</span>
                <Icon name={collapsedGroup ? "chevronRight" : "chevronDown"} size={13} />
              </button>
              {collapsedGroup ? null : (
                <ul className="nav-group-items">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="nav-btn"
                        data-active={active === item.id}
                        aria-current={active === item.id ? "page" : undefined}
                        onClick={() => onNavigate?.(item.id)}
                      >
                        <span className="nav-icon" aria-hidden="true">
                          <Icon name={item.icon} size={18} />
                        </span>
                        <span className="nav-label">{t(item.labelKey)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-list">{children}</div>

      <div className="sidebar-footer" role="group" aria-label={t("sidebar.nav.system")}>
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
              <Icon name={item.icon} size={18} />
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
            <Icon name={theme === "dark" ? "moon" : "sun"} size={18} />
          </span>
          <span className="nav-label">
            {theme === "dark" ? t("sidebar.theme.dark") : t("sidebar.theme.light")}
          </span>
        </button>
      </div>
    </nav>
  );
}
