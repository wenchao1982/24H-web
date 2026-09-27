import { useState } from "react";
import { api } from "../api/client";
import { t, type TranslationKey } from "../i18n";
import { buildOpsBody, normalizeOpsResult, OPS_ACTIONS, type OpsAction } from "./ops";

const OPS_PATH = "/api/hermes/ops";

function actionLabelKey(action: OpsAction): TranslationKey {
  return `ops.action.${action}` as TranslationKey;
}

/** 设置 → 高级 → 运维：诊断 / 备份 / 导入 / 转储（超级管理员，操作前确认）。 */
export default function OpsPanel() {
  const [results, setResults] = useState<Partial<Record<OpsAction, string>>>({});
  const [importPath, setImportPath] = useState("");
  const [busy, setBusy] = useState<OpsAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: OpsAction) => {
    if (!window.confirm(t("ops.confirm", { name: t(actionLabelKey(action)) }))) {
      return;
    }
    setBusy(action);
    setError(null);
    void (async () => {
      try {
        const body = buildOpsBody(action, importPath);
        const result = normalizeOpsResult(
          await api(`${OPS_PATH}/${action}`, { method: "POST", body: JSON.stringify(body) }),
        );
        setResults((current) => ({ ...current, [action]: result.output }));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("ops.error.action"));
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("ops.title")}</h3>
        <p className="muted">{t("ops.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <label className="config-row">
          <span>{t("ops.importPath")}</span>
          <input
            aria-label={t("ops.importPath")}
            placeholder="/path/to/backup"
            value={importPath}
            onChange={(event) => setImportPath(event.target.value)}
          />
        </label>
        <div className="row">
          {OPS_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              className="ghost"
              disabled={busy !== null}
              aria-label={t("ops.runAria", { name: t(actionLabelKey(action)) })}
              onClick={() => run(action)}
            >
              {t(actionLabelKey(action))}
            </button>
          ))}
        </div>
        {OPS_ACTIONS.map((action) =>
          results[action] !== undefined ? (
            <div className="ops-result" key={action}>
              <h4>{t(actionLabelKey(action))}</h4>
              <pre className="toolset-config">{results[action]}</pre>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
