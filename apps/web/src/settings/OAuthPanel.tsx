import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeOAuthProviders, normalizeOAuthStart, type OAuthProvider } from "./oauth";

/** 设置 → 模型服务商 OAuth：列表 / 发起授权 / 轮询 / 断开。 */
export default function OAuthPanel() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [startInfo, setStartInfo] = useState<{ id: string; url: string; code: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<unknown>("/api/hermes/providers/oauth");
      setProviders(normalizeOAuthProviders(payload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载服务商失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async (provider: OAuthProvider) => {
    setBusy(provider.id);
    try {
      const info = normalizeOAuthStart(
        await api<unknown>(`/api/hermes/providers/oauth/${encodeURIComponent(provider.id)}/start`, {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
      setStartInfo({ id: provider.id, url: info.url, code: info.code });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发起授权失败");
    } finally {
      setBusy(null);
    }
  };

  const poll = async (provider: OAuthProvider) => {
    setBusy(provider.id);
    try {
      const result = (await api<unknown>(
        `/api/hermes/providers/oauth/${encodeURIComponent(provider.id)}/poll`,
      )) as { connected?: boolean; status?: string };
      const connected = result.connected === true || result.status === "connected";
      if (connected) {
        setProviders((current) =>
          current.map((entry) =>
            entry.id === provider.id ? { ...entry, connected: true } : entry,
          ),
        );
        setStartInfo(null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "轮询授权失败");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (provider: OAuthProvider) => {
    setBusy(provider.id);
    try {
      await api(`/api/hermes/providers/oauth/${encodeURIComponent(provider.id)}`, {
        method: "DELETE",
      });
      setProviders((current) =>
        current.map((entry) =>
          entry.id === provider.id ? { ...entry, connected: false } : entry,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "断开失败");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="empty">加载服务商中…</p>;
  }

  return (
    <div className="settings-section">
      {error ? <p className="err">{error}</p> : null}
      <div className="card">
        <h3>模型服务商</h3>
        {providers.length === 0 ? (
          <p className="empty">暂无可用的 OAuth 服务商。</p>
        ) : (
          <ul className="toolset-list">
            {providers.map((provider) => (
              <li className="toolset-item" key={provider.id}>
                <span className="skill-name">{provider.name}</span>
                <span className="skill-desc muted">
                  {provider.connected ? "已连接" : "未连接"}
                </span>
                {provider.connected ? (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy === provider.id}
                    onClick={() => void disconnect(provider)}
                  >
                    断开
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy === provider.id}
                    onClick={() => void start(provider)}
                  >
                    授权
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {startInfo ? (
        <div className="card">
          <h3>完成授权</h3>
          <p className="muted">请在浏览器打开以下地址完成登录：</p>
          {startInfo.url ? <p className="oauth-url">{startInfo.url}</p> : null}
          {startInfo.code ? <p className="muted">设备码：{startInfo.code}</p> : null}
          <button
            type="button"
            className="primary"
            disabled={busy !== null}
            onClick={() => {
              const provider = providers.find((entry) => entry.id === startInfo.id);
              if (provider) {
                void poll(provider);
              }
            }}
          >
            我已完成授权
          </button>
        </div>
      ) : null}
    </div>
  );
}
