import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import {
  buildWebhookBody,
  normalizeEvents,
  normalizeWebhooks,
  type Webhook,
} from "./webhooks";

const WEBHOOKS_PATH = "/api/hermes/webhooks";

/** 设置 → 集成 → Webhooks：列表 / 新建 / 启停 / 删除。 */
export default function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [eventsText, setEventsText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWebhooks(normalizeWebhooks(await api<unknown>(WEBHOOKS_PATH)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("webhooks.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = (event: FormEvent) => {
    event.preventDefault();
    const hookName = name.trim();
    const target = url.trim();
    if (!hookName || !target) {
      setError(t("webhooks.error.create"));
      return;
    }
    setBusy("create");
    void (async () => {
      try {
        await api(WEBHOOKS_PATH, {
          method: "POST",
          body: JSON.stringify(
            buildWebhookBody({ name: hookName, url: target, events: normalizeEvents(eventsText) }),
          ),
        });
        setName("");
        setUrl("");
        setEventsText("");
        setError(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("webhooks.error.create"));
      } finally {
        setBusy(null);
      }
    })();
  };

  const toggle = (webhook: Webhook) => {
    setBusy(webhook.name);
    void (async () => {
      try {
        await api(`${WEBHOOKS_PATH}/${encodeURIComponent(webhook.name)}`, {
          method: "PUT",
          body: JSON.stringify({ enabled: !webhook.enabled }),
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("webhooks.error.save"));
      } finally {
        setBusy(null);
      }
    })();
  };

  const remove = (webhook: Webhook) => {
    setBusy(webhook.name);
    void (async () => {
      try {
        await api(`${WEBHOOKS_PATH}/${encodeURIComponent(webhook.name)}`, { method: "DELETE" });
        setWebhooks((current) => current.filter((entry) => entry.name !== webhook.name));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("webhooks.error.delete"));
      } finally {
        setBusy(null);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("webhooks.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("webhooks.title")}</h3>
        <p className="muted">{t("webhooks.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <form onSubmit={create}>
          <div className="row">
            <input
              aria-label={t("webhooks.name")}
              placeholder={t("webhooks.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              aria-label={t("webhooks.url")}
              placeholder={t("webhooks.url")}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <input
              aria-label={t("webhooks.events")}
              placeholder={t("webhooks.eventsHint")}
              value={eventsText}
              onChange={(event) => setEventsText(event.target.value)}
            />
            <button className="primary" type="submit" disabled={busy === "create"}>
              {t("webhooks.create")}
            </button>
          </div>
        </form>

        {webhooks.length === 0 ? (
          <p className="empty">{t("webhooks.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {webhooks.map((webhook) => (
              <li className="toolset-item" key={webhook.name}>
                <span className="skill-name">{webhook.name}</span>
                <span className="skill-desc muted">{webhook.url}</span>
                <span className="skill-desc muted">
                  {webhook.events.length > 0 ? webhook.events.join(", ") : t("webhooks.allEvents")}
                </span>
                <label className="config-row">
                  <input
                    type="checkbox"
                    aria-label={t("webhooks.enable", { name: webhook.name })}
                    checked={webhook.enabled}
                    disabled={busy === webhook.name}
                    onChange={() => toggle(webhook)}
                  />
                  <span>{t("webhooks.enabled")}</span>
                </label>
                <button
                  type="button"
                  className="danger"
                  aria-label={t("webhooks.deleteAria", { name: webhook.name })}
                  disabled={busy === webhook.name}
                  onClick={() => remove(webhook)}
                >
                  {t("webhooks.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
