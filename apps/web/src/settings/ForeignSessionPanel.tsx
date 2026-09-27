import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import {
  foreignParams,
  normalizeForeignPreview,
  normalizeForeignSessions,
  type ForeignSession,
} from "./foreignSessions";

/** 设置 → 高级 → 外部会话导入：列出外部会话，预览并导入。 */
export default function ForeignSessionPanel() {
  const gateway = useGateway();
  const [sessions, setSessions] = useState<ForeignSession[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(normalizeForeignSessions(await gateway.request("session.foreign.list", {})));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("foreign.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPreview = async (session: ForeignSession) => {
    setSelected(session.id);
    setPreview("");
    setError(null);
    try {
      setPreview(
        normalizeForeignPreview(
          await gateway.request("session.foreign.preview", foreignParams(session.id)),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("foreign.error.action"));
    }
  };

  const importSession = async (session: ForeignSession) => {
    if (!window.confirm(t("foreign.confirm", { title: session.title }))) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await gateway.request("session.foreign.import", foreignParams(session.id));
      setNotice(t("foreign.imported", { title: session.title }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("foreign.error.action"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="empty">{t("foreign.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("foreign.title")}</h3>
        <p className="muted">{t("foreign.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="muted">{notice}</p> : null}
        {sessions.length === 0 ? (
          <p className="empty">{t("foreign.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {sessions.map((session) => (
              <li className="toolset-item foreign-item" key={session.id}>
                <button
                  type="button"
                  className="session-item"
                  data-active={session.id === selected}
                  aria-label={t("foreign.previewAria", { title: session.title })}
                  onClick={() => void openPreview(session)}
                >
                  {session.title}
                  {session.source ? ` · ${session.source}` : ""}
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  aria-label={t("foreign.importAria", { title: session.title })}
                  onClick={() => void importSession(session)}
                >
                  {t("foreign.import")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected ? (
          <pre className="toolset-config foreign-preview">{preview || t("foreign.noPreview")}</pre>
        ) : null}
      </div>
    </div>
  );
}
