import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppShell from "./AppShell";
import { BOTTOM_NAV, PRIMARY_NAV } from "./nav";
import { useSession } from "../auth/SessionProvider";

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

const LABELS: Record<string, string> = Object.fromEntries(
  [...PRIMARY_NAV, ...BOTTOM_NAV].map((item) => [item.id, item.label]),
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
      title={LABELS[active] ?? "24H"}
      version="v0.1.0"
    >
      <Outlet />
    </AppShell>
  );
}
