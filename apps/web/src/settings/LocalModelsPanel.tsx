import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t, type TranslationKey } from "../i18n";
import {
  buildLocalModelAction,
  modelStateKey,
  normalizeCatalog,
  normalizeLocalModels,
  type LocalModel,
  type LocalModelAction,
  type LocalModelCatalogEntry,
} from "./localModels";

const STATUS_PATH = "/api/hermes/local-models/status";
const CATALOG_PATH = "/api/hermes/local-models/catalog";

function actionPath(action: LocalModelAction): string {
  return `/api/hermes/local-models/${action}`;
}

/** 设置 → 高级 → 本地模型：状态 + 模型库，下载 / 启动 / 卸载。 */
export default function LocalModelsPanel() {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [catalog, setCatalog] = useState<LocalModelCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [status, list] = await Promise.all([
        api<unknown>(STATUS_PATH),
        api<unknown>(CATALOG_PATH),
      ]);
      setModels(normalizeLocalModels(status));
      setCatalog(normalizeCatalog(list));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("localModels.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = (action: LocalModelAction, id: string) => {
    setBusy(`${action}:${id}`);
    setNotice(null);
    void (async () => {
      try {
        await api(actionPath(action), {
          method: "POST",
          body: JSON.stringify(buildLocalModelAction(action, id)),
        });
        setNotice(t(`localModels.notice.${action}` as TranslationKey, { name: id }));
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("localModels.error.action"));
      } finally {
        setBusy(null);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("localModels.loading")}</p>;
  }

  const installedIds = new Set(models.map((model) => model.id));

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("localModels.title")}</h3>
        <p className="muted">{t("localModels.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="muted">{notice}</p> : null}

        <h4>{t("localModels.installed")}</h4>
        {models.length === 0 ? (
          <p className="empty">{t("localModels.emptyInstalled")}</p>
        ) : (
          <ul className="toolset-list">
            {models.map((model) => {
              const running = model.state === "running";
              return (
                <li className="toolset-item local-model-item" key={model.id}>
                  <span className="skill-name">{model.name}</span>
                  <span className="skill-desc muted" aria-label={t("localModels.stateLabel", { name: model.name })}>
                    {t(modelStateKey(model.state) as TranslationKey)}
                    {model.size ? ` · ${model.size}` : ""}
                  </span>
                  {running ? (
                    <button
                      type="button"
                      className="danger"
                      disabled={busy !== null}
                      aria-label={t("localModels.ejectAria", { name: model.name })}
                      onClick={() => run("eject", model.id)}
                    >
                      {t("localModels.eject")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary"
                      disabled={busy !== null || model.state === "downloading"}
                      aria-label={t("localModels.startAria", { name: model.name })}
                      onClick={() => run("start", model.id)}
                    >
                      {t("localModels.start")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h4>{t("localModels.catalog")}</h4>
        {catalog.length === 0 ? (
          <p className="empty">{t("localModels.emptyCatalog")}</p>
        ) : (
          <ul className="toolset-list">
            {catalog.map((entry) => (
              <li className="toolset-item local-model-item" key={entry.id}>
                <span className="skill-name">{entry.name}</span>
                {entry.size ? <span className="skill-desc muted">{entry.size}</span> : null}
                <button
                  type="button"
                  className="primary"
                  disabled={busy !== null || entry.installed || installedIds.has(entry.id)}
                  aria-label={t("localModels.downloadAria", { name: entry.name })}
                  onClick={() => run("download", entry.id)}
                >
                  {entry.installed || installedIds.has(entry.id)
                    ? t("localModels.downloaded")
                    : t("localModels.download")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
