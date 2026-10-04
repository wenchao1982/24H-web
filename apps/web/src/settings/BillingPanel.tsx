import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { normalizeBilling, type BillingInfo } from "./billing";
import { formatUsage, normalizePortal, type PortalInfo } from "./portal";

/** 设置 → 高级 → 计费/套餐：L1 `billing.state`/`subscription.state` + L2 门户（只读）。 */
export default function BillingPanel() {
  const gateway = useGateway();
  const [billing, setBilling] = useState<BillingInfo>({});
  const [portal, setPortal] = useState<PortalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billingState, subscription, portalRaw] = await Promise.all([
        gateway.request("billing.state", {}).catch(() => null),
        gateway.request("subscription.state", {}).catch(() => null),
        api<unknown>("/api/hermes/portal").catch(() => null),
      ]);
      const merged = normalizeBilling(billingState, subscription, portalRaw);
      setBilling(merged);
      setPortal(normalizePortal(portalRaw));
      if (
        Object.keys(merged).length === 0 &&
        normalizePortal(portalRaw) === null
      ) {
        setError(t("billing.error.load"));
      } else {
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("billing.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">{t("billing.loading")}</p>;
  }

  const hasBilling = Object.keys(billing).length > 0;
  const hasPortal = portal !== null;

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("billing.title")}</h3>
        <p className="muted">{t("billing.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {!hasBilling && !hasPortal ? (
          <p className="empty">{t("billing.empty")}</p>
        ) : null}
        {hasBilling ? (
          <dl className="billing-info">
            {billing.plan ? (
              <>
                <dt>{t("billing.plan")}</dt>
                <dd>{billing.plan}</dd>
              </>
            ) : null}
            {billing.status ? (
              <>
                <dt>{t("billing.status")}</dt>
                <dd>{billing.status}</dd>
              </>
            ) : null}
            {billing.renewsAt ? (
              <>
                <dt>{t("billing.renews")}</dt>
                <dd>{billing.renewsAt}</dd>
              </>
            ) : null}
            {billing.seats !== undefined ? (
              <>
                <dt>{t("billing.seats")}</dt>
                <dd>{billing.seats}</dd>
              </>
            ) : null}
            {billing.balance ? (
              <>
                <dt>{t("billing.balance")}</dt>
                <dd>{billing.balance}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {hasPortal ? (
          <div className="billing-portal">
            <h4>{t("billing.portal")}</h4>
            <p className="muted" aria-label={t("billing.portalPlan")}>
              {t("billing.plan")}：{portal.plan}
              {portal.status ? ` · ${portal.status}` : ""}
              {portal.usage ? ` · ${formatUsage(portal.usage)}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
