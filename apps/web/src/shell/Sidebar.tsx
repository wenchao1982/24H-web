import type { ReactNode } from "react";
import { BOTTOM_NAV, PRIMARY_NAV, type NavItem } from "./nav";

export interface SidebarProps {
  active?: string;
  onNavigate?: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isSuperAdmin?: boolean;
  version?: string;
  coreOnline?: boolean;
  channelOnline?: boolean;
  /** 上下文列表（随当前区切换）。 */
  children?: ReactNode;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

function visibleBottom(isSuperAdmin: boolean): NavItem[] {
  return BOTTOM_NAV.filter((item) => !item.superAdminOnly || isSuperAdmin);
}

export default function Sidebar({
  active,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  isSuperAdmin = false,
  version,
  coreOnline = true,
  channelOnline = true,
  children,
  theme = "light",
  onToggleTheme,
}: SidebarProps) {
  return (
    <nav className="sidebar" data-collapsed={collapsed} aria-label="主导航">
      <div className="brand">
        <span className="brand-mark">24H</span>
        {version ? <span className="brand-version">{version}</span> : null}
        <span className="brand-status" title={coreOnline ? "核心在线" : "核心离线"}>
          <i className="dot" data-on={coreOnline} aria-hidden="true" />
          核心
        </span>
        <span className="brand-status" title={channelOnline ? "渠道在线" : "渠道离线"}>
          <i className="dot" data-on={channelOnline} aria-hidden="true" />
          渠道
        </span>
        <button
          type="button"
          className="icon-btn sidebar-toggle"
          aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
          onClick={onToggleCollapse}
        >
          {collapsed ? "»" : "«"}
        </button>
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
              <span className="nav-label">{item.label}</span>
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
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="nav-btn theme-toggle"
          aria-label="切换主题"
          onClick={onToggleTheme}
        >
          <span className="nav-icon" aria-hidden="true">
            {theme === "dark" ? "☾" : "☀"}
          </span>
          <span className="nav-label">{theme === "dark" ? "深色" : "浅色"}</span>
        </button>
      </div>
    </nav>
  );
}
