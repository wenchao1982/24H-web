import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import {
  normalizeUpdate,
  normalizeVersion,
  updateParams,
  type SystemVersion,
  type UpdateResult,
} from "./systemUpdate";

const VERSION_PATH = "/api/system/version";
const UPDATE_PATH = "/api/system/update";

/** 设置 → 系统 → 升级：核心 + web 版本；在线升级属运维级，返回明确结果。 */
export default function UpgradePanel() {
  const [version, setVersion] = useState<SystemVersion | null>(null);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVersion(normalizeVersion(await api<unknown>(VERSION_PATH)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("upgrade.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = () => {
    setBusy(true);
    setResult(null);
    void (async () => {
      try {
        setResult(
          normalizeUpdate(
            await api(UPDATE_PATH, {
              method: "POST",
              body: JSON.stringify(updateParams("apply")),
            }),
          ),
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("upgrade.error.update"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("upgrade.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("upgrade.title")}</h3>
        <p className="muted">{t("upgrade.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <dl className="upgrade-info">
          <dt>{t("upgrade.core")}</dt>
          <dd aria-label={t("upgrade.coreLabel")}>{version?.core ?? t("upgrade.unknown")}</dd>
          <dt>{t("upgrade.web")}</dt>
          <dd aria-label={t("upgrade.webLabel")}>{version?.web ?? t("upgrade.unknown")}</dd>
        </dl>
        <div className="row">
          <button type="button" className="ghost" disabled={busy} onClick={() => void load()}>
            {t("upgrade.check")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            aria-label={t("upgrade.apply")}
            onClick={update}
          >
            {t("upgrade.apply")}
          </button>
        </div>
        {result ? (
          <p aria-label={t("upgrade.resultLabel")}>
            {result.message ||
              (result.status === "queued" ? t("upgrade.queued") : t("upgrade.unsupported"))}
          </p>
        ) : null}
      </div>
    </div>
  );
}
