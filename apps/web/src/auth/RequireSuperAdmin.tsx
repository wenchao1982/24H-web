import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "./SessionProvider";

/** 仅 super_admin 可进入；其余重定向回对话。 */
export default function RequireSuperAdmin() {
  const { user } = useSession();

  if (user?.role !== "super_admin") {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
}
