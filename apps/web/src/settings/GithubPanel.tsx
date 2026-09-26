import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

interface GithubStatus {
  connected: boolean;
  username: string | null;
}

function normalizeStatus(payload: unknown): GithubStatus {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    connected: source.connected === true,
    username: typeof source.username === "string" ? source.username : null,
  };
}

/** 设置 → GitHub 集成：gh 状态 + 用 token 连接（BFF 自有接口）。 */
export default function GithubPanel() {
  const [status, setStatus] = useState<GithubStatus>({ connected: false, username: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(normalizeStatus(await api<unknown>("/api/integrations/github")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 GitHub 状态失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    if (!token.trim()) {
      setError("请输入访问令牌");
      return;
    }
    setBusy(true);
    try {
      const next = normalizeStatus(
        await api<unknown>("/api/integrations/github", {
          method: "POST",
          body: JSON.stringify({ action: "connect", token: token.trim() }),
        }),
      );
      setStatus(next);
      setToken("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接 GitHub 失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="empty">加载 GitHub 状态中…</p>;
  }

  return (
    <div className="settings-section">
      {error ? <p className="err">{error}</p> : null}
      <div className="card">
        <h3>GitHub 集成</h3>
        <p className="muted" aria-label="GitHub 状态">
          {status.connected
            ? `已连接${status.username ? `：${status.username}` : ""}`
            : "未连接"}
        </p>
        <div className="row">
          <input
            aria-label="GitHub 访问令牌"
            type="password"
            placeholder="ghp_...（personal access token）"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <button className="primary" type="button" disabled={busy} onClick={() => void connect()}>
            连接
          </button>
        </div>
      </div>
    </div>
  );
}
