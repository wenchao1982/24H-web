import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "./SessionProvider";

/** 未登录 → 重定向到 /login（带上来源路径）。 */
export default function RequireAuth() {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <div className="empty">加载中…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
