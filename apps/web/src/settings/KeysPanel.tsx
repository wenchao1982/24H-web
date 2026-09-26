import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { ENV_KEY_PATTERN, normalizeEnvNames } from "./env";

/** 设置 → 模型与密钥：Keys 列表（仅名称，永不回显明文）+ 设置/删除。 */
export default function KeysPanel() {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<unknown>("/api/hermes/env");
      setKeys(normalizeEnvNames(payload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载密钥失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const key = name.trim();
    if (!ENV_KEY_PATTERN.test(key) || value === "") {
      setError("键名需为大写字母/数字/下划线，值不能为空");
      return;
    }
    setBusy(key);
    void (async () => {
      try {
        await api("/api/hermes/env", {
          method: "POST",
          body: JSON.stringify({ name: key, value }),
        });
        setName("");
        setValue("");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存密钥失败");
      } finally {
        setBusy(null);
      }
    })();
  };

  const remove = (key: string) => {
    setBusy(key);
    void (async () => {
      try {
        await api(`/api/hermes/env?name=${encodeURIComponent(key)}`, { method: "DELETE" });
        setKeys((current) => current.filter((entry) => entry !== key));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "删除密钥失败");
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <div className="settings-section">
      <div className="card">
        <h3>设置密钥</h3>
        <form onSubmit={submit}>
          <div className="row">
            <input
              aria-label="密钥名称"
              placeholder="OPENAI_API_KEY"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              aria-label="密钥值"
              type="password"
              placeholder="值（不会回显）"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <button className="primary" type="submit" disabled={busy !== null}>
              保存
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>已配置密钥</h3>
        {error ? <p className="err">{error}</p> : null}
        {loading ? (
          <p className="empty">加载中…</p>
        ) : keys.length === 0 ? (
          <p className="empty">暂无密钥。</p>
        ) : (
          <ul className="toolset-list">
            {keys.map((key) => (
              <li className="toolset-item" key={key}>
                <span className="skill-name">{key}</span>
                <span className="skill-desc muted" aria-label={`${key} 值`}>
                  ••••••••
                </span>
                <button
                  type="button"
                  className="danger"
                  disabled={busy === key}
                  onClick={() => remove(key)}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
