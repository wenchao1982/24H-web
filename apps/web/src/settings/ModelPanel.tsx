import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t, type TranslationKey } from "../i18n";
import { normalizeMoa, normalizeModelInfo, normalizeModelOptions, type MoaState } from "./model";
import ProviderRoutingPanel from "./ProviderRoutingPanel";
import FallbackProviderPanel from "./FallbackProviderPanel";
import CredentialPoolsPanel from "./CredentialPoolsPanel";

interface SubTab {
  id: string;
  labelKey: TranslationKey;
}

const SUB_TABS: SubTab[] = [
  { id: "current", labelKey: "model.subtab.current" },
  { id: "routing", labelKey: "model.subtab.routing" },
  { id: "fallback", labelKey: "model.subtab.fallback" },
  { id: "pools", labelKey: "model.subtab.pools" },
];

/** 设置 → 模型：当前模型 / 可选模型切换 / MoA / Provider 路由。 */
export default function ModelPanel() {
  const [tab, setTab] = useState<string>("current");
  const [current, setCurrent] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [moa, setMoa] = useState<MoaState>({ enabled: false, models: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const info = normalizeModelInfo(await api<unknown>("/api/hermes/model/info"));
      const opts = normalizeModelOptions(await api<unknown>("/api/hermes/model/options"));
      const moaState = normalizeMoa(await api<unknown>("/api/hermes/model/moa"));
      setCurrent(info);
      setOptions(opts);
      setSelected(info || opts[0] || "");
      setMoa(moaState);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载模型设置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyModel = async () => {
    if (!selected) {
      return;
    }
    setBusy(true);
    try {
      await api("/api/hermes/model/set", {
        method: "POST",
        body: JSON.stringify({ model: selected }),
      });
      setCurrent(selected);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换模型失败");
    } finally {
      setBusy(false);
    }
  };

  const toggleMoa = async (enabled: boolean) => {
    setBusy(true);
    try {
      await api("/api/hermes/model/moa", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      setMoa((state) => ({ ...state, enabled }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换 MoA 失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="empty">加载模型设置中…</p>;
  }

  return (
    <div className="settings-section">
      <nav className="segmented" aria-label={t("model.subtabsAria")}>
        {SUB_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="segmented-btn"
            data-active={tab === item.id}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      {tab === "routing" ? <ProviderRoutingPanel /> : null}
      {tab === "fallback" ? <FallbackProviderPanel /> : null}
      {tab === "pools" ? <CredentialPoolsPanel /> : null}

      {tab === "current" ? (
        <>
          {error ? <p className="err">{error}</p> : null}

          <div className="card">
            <h3>当前模型</h3>
            <p className="muted" aria-label="当前模型">
              {current || "未设置"}
            </p>
            <div className="row">
              <select
                aria-label="选择模型"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {options.length === 0 ? <option value="">（无可用模型）</option> : null}
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                className="primary"
                type="button"
                disabled={busy || !selected}
                onClick={applyModel}
              >
                切换
              </button>
            </div>
          </div>

          <div className="card">
            <h3>混合代理（MoA）</h3>
            <label className="skill-toggle">
              <input
                type="checkbox"
                aria-label="启用 MoA"
                checked={moa.enabled}
                disabled={busy}
                onChange={(event) => void toggleMoa(event.target.checked)}
              />
              <span className="muted">启用混合代理</span>
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}
