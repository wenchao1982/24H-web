import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import { loadConfig, saveConfigPath } from "./configForm";
import { maskedKey, normalizeWebSearch, readDocumentExtraction, type WebSearchConfig } from "./searchTools";

const WEB_SEARCH_PATH = "/api/hermes/tools/toolsets/web-search/config";

/** 设置 → 高级 → 搜索 / 抽取（T23.8）：Web Search provider（密钥掩码）+ Document Extraction 开关。 */
export default function SearchExtractionPanel() {
  const [search, setSearch] = useState<WebSearchConfig | null>(null);
  const [extraction, setExtraction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await loadConfig();
      let webSearch: WebSearchConfig;
      try {
        webSearch = normalizeWebSearch(await api<unknown>(WEB_SEARCH_PATH));
      } catch {
        webSearch = normalizeWebSearch(config);
      }
      setSearch(webSearch);
      setExtraction(readDocumentExtraction(config));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("searchTools.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExtraction = (enabled: boolean) => {
    setBusy(true);
    void (async () => {
      try {
        await saveConfigPath("document_extraction.enabled", enabled);
        setExtraction(enabled);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("searchTools.error.save"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("searchTools.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("searchTools.title")}</h3>
        <p className="muted">{t("searchTools.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        <h4>{t("searchTools.webSearch")}</h4>
        {search && search.provider ? (
          <p aria-label={t("searchTools.providerLabel")}>
            {t("searchTools.provider", { provider: search.provider })}
          </p>
        ) : (
          <p className="empty">{t("searchTools.empty")}</p>
        )}
        {search && search.keyNames.length > 0 ? (
          <ul className="toolset-list">
            {search.keyNames.map((name) => (
              <li className="toolset-item" key={name}>
                <span className="skill-name">{name}</span>
                <span className="skill-desc muted" aria-label={t("searchTools.keyMasked", { name })}>
                  {maskedKey()}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <h4>{t("searchTools.extraction")}</h4>
        <label className="config-row">
          <input
            type="checkbox"
            aria-label={t("searchTools.extractionEnabled")}
            checked={extraction}
            disabled={busy}
            onChange={(event) => toggleExtraction(event.target.checked)}
          />
          <span>{t("searchTools.extractionEnabled")}</span>
        </label>
      </div>
    </div>
  );
}
