import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import {
  normalizeFacts,
  normalizeVerification,
  type Fact,
  type Verification,
} from "./projectFacts";

/** 设置 → 高级 → 项目事实/校验：L1 `project.facts` + `verification.status`。 */
export default function ProjectFactsPanel() {
  const gateway = useGateway();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [factsResult, verifyResult] = await Promise.all([
        gateway.request("project.facts", {}),
        gateway.request("verification.status", {}).catch(() => null),
      ]);
      setFacts(normalizeFacts(factsResult));
      setVerification(normalizeVerification(verifyResult));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("facts.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">{t("facts.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <div className="project-facts-head">
          <h3>{t("facts.title")}</h3>
          <button type="button" className="ghost" onClick={() => void load()}>
            {t("facts.refresh")}
          </button>
        </div>
        <p className="muted">{t("facts.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        <h4>{t("facts.factsTitle")}</h4>
        {facts.length === 0 ? (
          <p className="empty">{t("facts.empty")}</p>
        ) : (
          <dl className="project-facts">
            {facts.map((fact) => (
              <div className="project-fact" key={fact.key}>
                <dt>{fact.key}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <h4>{t("facts.verifyTitle")}</h4>
        {verification ? (
          <>
            <p aria-label={t("facts.verifyState")}>{verification.state || t("facts.unknown")}</p>
            {verification.detail ? <p className="muted">{verification.detail}</p> : null}
            {verification.checks.length > 0 ? (
              <ul className="toolset-list">
                {verification.checks.map((check) => (
                  <li className="toolset-item" key={check.name}>
                    <span className="skill-name">{check.name}</span>
                    <span className="skill-desc muted">{check.status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="empty">{t("facts.verifyEmpty")}</p>
        )}
      </div>
    </div>
  );
}
