import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import {
  buildPatch,
  COMMON_FIELDS,
  normalizeConfig,
  readPath,
} from "./config";

/** 设置 → 配置中心：常用 config.yaml 字段的读取与保存。 */
export default function ConfigPanel() {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const applyConfig = useCallback((next: Record<string, unknown>) => {
    setConfig(next);
    const values: Record<string, boolean> = {};
    for (const field of COMMON_FIELDS) {
      values[field.path] = readPath(next, field.path) === true;
    }
    setDraft(values);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      applyConfig(normalizeConfig(await api<unknown>("/api/hermes/config")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const changes: Record<string, unknown> = {};
    for (const field of COMMON_FIELDS) {
      const current = readPath(config, field.path) === true;
      if (draft[field.path] !== current) {
        changes[field.path] = draft[field.path];
      }
    }
    if (Object.keys(changes).length === 0) {
      setSaved(true);
      return;
    }
    setBusy(true);
    setSaved(false);
    try {
      await api("/api/hermes/config", {
        method: "PUT",
        body: JSON.stringify(buildPatch(changes)),
      });
      applyConfig({ ...config, ...buildPatch(changes) });
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存配置失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="empty">加载配置中…</p>;
  }

  return (
    <div className="settings-section">
      {error ? <p className="err">{error}</p> : null}
      <div className="card">
        <h3>常用配置</h3>
        {COMMON_FIELDS.map((field) => (
          <label className="config-row" key={field.path}>
            <input
              type="checkbox"
              aria-label={field.label}
              checked={draft[field.path] ?? false}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.path]: event.target.checked }))
              }
            />
            <span>{field.label}</span>
          </label>
        ))}
        <div className="row">
          <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
            保存
          </button>
          {saved ? <span className="muted">已保存</span> : null}
        </div>
      </div>
    </div>
  );
}
