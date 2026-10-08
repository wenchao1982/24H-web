import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./auth/SessionProvider";
import RequireAuth from "./auth/RequireAuth";
import RequireSuperAdmin from "./auth/RequireSuperAdmin";
import ShellLayout from "./shell/ShellLayout";
import { ToastProvider } from "./ui/Toast";
import { GatewayProvider } from "./chat/GatewayProvider";
import { NotificationsProvider } from "./notifications/NotificationsProvider";
import { t } from "./i18n";

// 路由级代码分割：每个页面单独成 chunk，首屏不再一次性加载全部页面。
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AgentsPage = lazy(() => import("./agents/AgentsPage"));
const GroupChatPage = lazy(() => import("./groups/GroupChatPage"));
const TasksPage = lazy(() => import("./tasks/TasksPage"));
const KanbanPage = lazy(() => import("./kanban/KanbanPage"));
const OrchestrationPage = lazy(() => import("./orchestration/OrchestrationPage"));
const UsagePage = lazy(() => import("./usage/UsagePage"));
const MonitorPage = lazy(() => import("./insights/MonitorPage"));
const MemoryPage = lazy(() => import("./insights/MemoryPage"));
const ProjectsPage = lazy(() => import("./workspace/ProjectsPage"));
const FilesPage = lazy(() => import("./workspace/FilesPage"));
const SkillsHostPage = lazy(() => import("./skillhost/SkillsHostPage"));
const SettingsPage = lazy(() => import("./settings/SettingsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const NotificationsPage = lazy(() => import("./notifications/NotificationsPage"));
const ChatPage = lazy(() => import("./chat/ChatPage"));

/** 懒加载占位：chunk 下载期间显示。 */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-busy="true">
      {t("common.loading")}
    </div>
  );
}

/** 路由表（可注入 MemoryRouter 单测）。 */
export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/orchestration" element={<OrchestrationPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/memory" element={<MemoryPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/skills-ui" element={<SkillsHostPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route element={<RequireSuperAdmin />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
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
