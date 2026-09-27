import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t, type TranslationKey } from "../i18n";
import { buildPatch, normalizeConfig, readPath } from "./config";

export type ConfigFieldType = "boolean" | "string" | "number";

export interface ConfigFieldDef {
  /** 配置点路径，如 `api_server.enabled`。 */
  path: string;
  labelKey: TranslationKey;
  type: ConfigFieldType;
  placeholderKey?: TranslationKey;
}

export interface ConfigFieldsPanelProps {
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  fields: ConfigFieldDef[];
}

type Draft = Record<string, boolean | string>;

function initialDraft(config: Record<string, unknown>, fields: ConfigFieldDef[]): Draft {
  const draft: Draft = {};
  for (const field of fields) {
    const value = readPath(config, field.path);
    draft[field.path] =
      field.type === "boolean" ? value === true : value === undefined || value === null ? "" : String(value);
  }
  return draft;
}

/**
 * M16 通用配置字段面板：布尔开关 / 文本 / 数字，读取 `GET /api/hermes/config`，
 * 仅把变更字段以扁平点路径 `PUT` 回去。用于 API Server / 工具网关 / 工具搜索等。
 */
export default function ConfigFieldsPanel({ titleKey, hintKey, fields }: ConfigFieldsPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = normalizeConfig(await api<unknown>("/api/hermes/config"));
      setConfig(next);
      setDraft(initialDraft(next, fields));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("configForm.error.load"));
    } finally {
      setLoading(false);
    }
  }, [fields]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = () => {
    const changes: Record<string, unknown> = {};
    for (const field of fields) {
      const original =
        field.type === "boolean" ? readPath(config, field.path) === true : readPath(config, field.path);
      const next = draft[field.path];
      if (field.type === "boolean") {
        if (next !== original) {
          changes[field.path] = next === true;
        }
      } else if (field.type === "number") {
        const parsed = next === "" ? undefined : Number(next);
        if (parsed !== undefined && parsed !== original) {
          changes[field.path] = parsed;
        }
      } else if (next !== (original === undefined || original === null ? "" : String(original))) {
        changes[field.path] = next;
      }
    }
    if (Object.keys(changes).length === 0) {
      setSaved(true);
      return;
    }
    setBusy(true);
    setSaved(false);
    void (async () => {
      try {
        await api("/api/hermes/config", {
          method: "PUT",
          body: JSON.stringify(buildPatch(changes)),
        });
        const merged = { ...config, ...buildPatch(changes) };
        setConfig(merged);
        setDraft(initialDraft(merged, fields));
        setSaved(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("configForm.error.save"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("configForm.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t(titleKey)}</h3>
        <p className="muted">{t(hintKey)}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {fields.map((field) =>
          field.type === "boolean" ? (
            <label className="config-row" key={field.path}>
              <input
                type="checkbox"
                aria-label={t(field.labelKey)}
                checked={draft[field.path] === true}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.path]: event.target.checked }))
                }
              />
              <span>{t(field.labelKey)}</span>
            </label>
          ) : (
            <label className="config-row" key={field.path}>
              <span>{t(field.labelKey)}</span>
              <input
                aria-label={t(field.labelKey)}
                type={field.type === "number" ? "number" : "text"}
                placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
                value={String(draft[field.path] ?? "")}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.path]: event.target.value }))
                }
              />
            </label>
          ),
        )}
        <div className="row">
          <button className="primary" type="button" disabled={busy} onClick={save}>
            {t("configForm.save")}
          </button>
          {saved ? <span className="muted">{t("configForm.saved")}</span> : null}
        </div>
      </div>
    </div>
  );
}
