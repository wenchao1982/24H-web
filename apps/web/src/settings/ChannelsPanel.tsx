import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import { buildPlatformBody, normalizePlatforms, type Platform } from "./channels";

const PLATFORMS_PATH = "/api/hermes/messaging/platforms";

interface Draft {
  enabled: boolean;
  values: Record<string, string>;
}

function initialDraft(platform: Platform): Draft {
  const values: Record<string, string> = {};
  for (const field of platform.fields) {
    values[field.key] = field.value;
  }
  return { enabled: platform.enabled, values };
}

/** 设置 → 渠道：平台列表 + 启停/配置（密钥仅掩码展示，留空保持不变）。 */
export default function ChannelsPanel() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = normalizePlatforms(await api<unknown>(PLATFORMS_PATH));
      setPlatforms(list);
      setDrafts(Object.fromEntries(list.map((platform) => [platform.id, initialDraft(platform)])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const setField = (id: string, key: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], values: { ...current[id].values, [key]: value } },
    }));
  };

  const save = (platform: Platform) => {
    const draft = drafts[platform.id];
    if (!draft) {
      return;
    }
    setBusy(platform.id);
    void (async () => {
      try {
        await api(`${PLATFORMS_PATH}/${encodeURIComponent(platform.id)}`, {
          method: "PUT",
          body: JSON.stringify(buildPlatformBody(draft.enabled, draft.values)),
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("channels.error.save"));
      } finally {
        setBusy(null);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("channels.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("channels.title")}</h3>
        <p className="muted">{t("channels.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {platforms.length === 0 ? (
          <p className="empty">{t("channels.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {platforms.map((platform) => {
              const draft = drafts[platform.id] ?? initialDraft(platform);
              return (
                <li className="toolset-item channel-item" key={platform.id}>
                  <div className="channel-head">
                    <span className="skill-name">{platform.name}</span>
                    <label className="config-row">
                      <input
                        type="checkbox"
                        aria-label={t("channels.enable", { name: platform.name })}
                        checked={draft.enabled}
                        onChange={(event) =>
                          update(platform.id, { enabled: event.target.checked })
                        }
                      />
                      <span>{t("channels.enabled")}</span>
                    </label>
                  </div>
                  <div className="channel-fields" aria-label={t("channels.configure", { name: platform.name })}>
                    {platform.fields.map((field) =>
                      field.secret ? (
                        <div className="config-row" key={field.key}>
                          <span className="skill-name">{field.key}</span>
                          {field.configured ? (
                            <span className="skill-desc muted" aria-label={`${field.key} 值`}>
                              ••••••••
                            </span>
                          ) : null}
                          <input
                            type="password"
                            aria-label={t("channels.secretInput", { key: field.key })}
                            placeholder={t("channels.keep")}
                            value={draft.values[field.key] ?? ""}
                            onChange={(event) => setField(platform.id, field.key, event.target.value)}
                          />
                        </div>
                      ) : (
                        <label className="config-row" key={field.key}>
                          <span className="skill-name">{field.key}</span>
                          <input
                            aria-label={field.key}
                            value={draft.values[field.key] ?? ""}
                            onChange={(event) => setField(platform.id, field.key, event.target.value)}
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="primary"
                      disabled={busy === platform.id}
                      onClick={() => save(platform)}
                    >
                      {t("channels.save")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
