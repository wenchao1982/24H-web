import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./auth/SessionProvider";
import RequireAuth from "./auth/RequireAuth";
import RequireSuperAdmin from "./auth/RequireSuperAdmin";
import ShellLayout from "./shell/ShellLayout";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import AgentsPage from "./agents/AgentsPage";
import GroupChatPage from "./groups/GroupChatPage";
import TasksPage from "./tasks/TasksPage";
import UsagePage from "./usage/UsagePage";
import SkillsHostPage from "./skillhost/SkillsHostPage";
import SettingsPage from "./settings/SettingsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import { ToastProvider } from "./ui/Toast";
import ChatPage from "./chat/ChatPage";
import { GatewayProvider } from "./chat/GatewayProvider";
import { NotificationsProvider } from "./notifications/NotificationsProvider";
import { t } from "./i18n";

/** 路由表（可注入 MemoryRouter 单测）。 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<ShellLayout />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/group-chat" element={<GroupChatPage />} />
          <Route path="/groups" element={<Navigate to="/group-chat" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/skills-ui" element={<SkillsHostPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
          <Route path="/account" element={<PlaceholderPage title={t("page.account")} />} />
          <Route path="/notifications" element={<PlaceholderPage title={t("page.notifications")} />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <GatewayProvider>
            <NotificationsProvider>
              <AppRoutes />
            </NotificationsProvider>
          </GatewayProvider>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
