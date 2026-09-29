import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, setUnauthorizedHandler } from "../api/client";

export interface SessionUser {
  id: number;
  username: string;
  role: "super_admin" | "admin";
  must_change_password: boolean;
  profiles?: string[];
  default_profile?: string | null;
}

export interface SessionValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<SessionUser | null>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  /** 测试注入：非 null 时直接采用，跳过首屏 `/api/auth/me` 请求。 */
  initialUser?: SessionUser | null;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState(initialUser === null);
  const seededRef = useRef(initialUser !== null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<SessionUser>("/api/auth/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (seededRef.current) {
      return;
    }
    let alive = true;
    api<SessionUser>("/api/auth/me")
      .then((me) => {
        if (alive) {
          setUser(me);
        }
      })
      .catch(() => {
        if (alive) {
          setUser(null);
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  // 全局 401：清空会话；路由守卫随即把用户送回 /login。
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // 登出失败也要在本地清会话
    }
    setUser(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession 必须在 SessionProvider 内使用");
  }
  return context;
}

/** 可选会话：无 `SessionProvider` 时返回 null（组件级测试可脱离会话上下文渲染）。 */
export function useOptionalSession(): SessionValue | null {
  return useContext(SessionContext);
}
