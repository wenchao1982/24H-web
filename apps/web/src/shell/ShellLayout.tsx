import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppShell from "./AppShell";
import { BOTTOM_NAV, PRIMARY_NAV } from "./nav";
import { useSession } from "../auth/SessionProvider";
import { t, type TranslationKey } from "../i18n";

const ROUTES: Record<string, string> = {
  chat: "/chat",
  agents: "/agents",
  groups: "/groups",
  tasks: "/tasks",
  usage: "/usage",
  settings: "/settings",
  admin: "/admin/users",
  account: "/account",
  notifications: "/notifications",
};

const LABELS: Record<string, TranslationKey> = Object.fromEntries(
  [...PRIMARY_NAV, ...BOTTOM_NAV].map((item) => [item.id, item.labelKey]),
);

function activeId(pathname: string): string {
  for (const [id, path] of Object.entries(ROUTES)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return id;
    }
  }
  return "chat";
}

export default function ShellLayout() {
  const { user } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeId(location.pathname);

  return (
    <AppShell
      active={active}
      onNavigate={(id) => navigate(ROUTES[id] ?? "/chat")}
      isSuperAdmin={user?.role === "super_admin"}
      title={t(LABELS[active] ?? "app.name")}
      version="v0.1.0"
      onOpenNotifications={(sessionId) =>
        navigate(sessionId ? `/chat?session=${encodeURIComponent(sessionId)}` : "/notifications")
      }
    >
      <Outlet />
    </AppShell>
  );
}
