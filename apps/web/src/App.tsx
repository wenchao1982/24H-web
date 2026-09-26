import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./auth/SessionProvider";
import RequireAuth from "./auth/RequireAuth";
import RequireSuperAdmin from "./auth/RequireSuperAdmin";
import ShellLayout from "./shell/ShellLayout";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import AgentsPage from "./agents/AgentsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import { ToastProvider } from "./ui/Toast";
import ChatPage from "./chat/ChatPage";
import { GatewayProvider } from "./chat/GatewayProvider";

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
          <Route path="/groups" element={<PlaceholderPage title="群聊" />} />
          <Route path="/tasks" element={<PlaceholderPage title="任务" />} />
          <Route path="/usage" element={<PlaceholderPage title="用量" />} />
          <Route path="/settings" element={<PlaceholderPage title="设置" />} />
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
          <Route path="/account" element={<PlaceholderPage title="账户" />} />
          <Route path="/notifications" element={<PlaceholderPage title="通知" />} />
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
            <AppRoutes />
          </GatewayProvider>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
