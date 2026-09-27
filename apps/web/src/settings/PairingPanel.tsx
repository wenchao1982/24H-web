import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t, type TranslationKey } from "../i18n";
import {
  buildPairingAction,
  normalizePairingDevices,
  normalizeSshOwnership,
  type PairingAction,
  type PairingDevice,
  type PairingState,
  type SshOwnership,
} from "./pairing";

const PAIRING_PATH = "/api/hermes/pairing";
const SSH_PATH = "/api/hermes/ssh/ownership";

function stateKey(state: PairingState): TranslationKey {
  return `pairing.state.${state}` as TranslationKey;
}

/** 设置 → 高级 → 配对与设备：设备审批 / 撤销 + SSH 归属。 */
export default function PairingPanel() {
  const [devices, setDevices] = useState<PairingDevice[]>([]);
  const [ownership, setOwnership] = useState<SshOwnership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pairing, ssh] = await Promise.all([
        api<unknown>(PAIRING_PATH),
        api<unknown>(SSH_PATH).catch(() => null),
      ]);
      setDevices(normalizePairingDevices(pairing));
      setOwnership(normalizeSshOwnership(ssh));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pairing.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = (action: PairingAction, device: PairingDevice) => {
    setBusy(device.id);
    void (async () => {
      try {
        await api(`${PAIRING_PATH}/${action}`, {
          method: "POST",
          body: JSON.stringify(buildPairingAction(device.id)),
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("pairing.error.action"));
      } finally {
        setBusy(null);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("pairing.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("pairing.title")}</h3>
        <p className="muted">{t("pairing.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {devices.length === 0 ? (
          <p className="empty">{t("pairing.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {devices.map((device) => {
              const pending = device.state === "pending";
              return (
                <li className="toolset-item pairing-item" key={device.id}>
                  <span className="skill-name">{device.name}</span>
                  <span className="skill-desc muted" aria-label={t("pairing.stateLabel", { name: device.name })}>
                    {t(stateKey(device.state))}
                    {device.kind ? ` · ${device.kind}` : ""}
                    {device.lastSeen ? ` · ${device.lastSeen}` : ""}
                  </span>
                  {pending ? (
                    <button
                      type="button"
                      className="primary"
                      disabled={busy === device.id}
                      aria-label={t("pairing.approveAria", { name: device.name })}
                      onClick={() => run("approve", device)}
                    >
                      {t("pairing.approve")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="danger"
                      disabled={busy === device.id || device.state === "revoked"}
                      aria-label={t("pairing.revokeAria", { name: device.name })}
                      onClick={() => run("revoke", device)}
                    >
                      {t("pairing.revoke")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h4>{t("pairing.ssh.title")}</h4>
        {ownership ? (
          <dl className="pairing-ssh">
            <dt>{t("pairing.ssh.owner")}</dt>
            <dd>{ownership.owner}</dd>
            {ownership.fingerprint ? (
              <>
                <dt>{t("pairing.ssh.fingerprint")}</dt>
                <dd>{ownership.fingerprint}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="empty">{t("pairing.ssh.empty")}</p>
        )}
      </div>
    </div>
  );
}
