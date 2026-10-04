import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t, type TranslationKey } from "../i18n";
import { normalizeConnectors, type Connector } from "./vault";

function connectorStatusKey(status: string): TranslationKey {
  if (status === "connected") {
    return "vault.connector.connected";
  }
  if (status === "disconnected") {
    return "vault.connector.disconnected";
  }
  return "vault.connector.unknown";
}

/** 设置 → 集成 → 连接器：连接器独立于密钥库（C03）。 */
export default function ConnectorsPanel() {
  const gateway = useGateway();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnectors(normalizeConnectors(await gateway.request("connectors.list", {})));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vault.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">{t("vault.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("connectors.title")}</h3>
        <p className="muted">{t("connectors.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {connectors.length === 0 ? (
          <p className="empty">{t("vault.connectorsEmpty")}</p>
        ) : (
          <ul className="toolset-list">
            {connectors.map((connector) => (
              <li className="toolset-item" key={connector.name}>
                <span className="skill-name">{connector.name}</span>
                <span className="skill-desc muted">{t(connectorStatusKey(connector.status))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
