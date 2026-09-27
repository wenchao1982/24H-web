import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { normalizeBotScreens, type BotScreen } from "./botScreen";

/**
 * 智能体页「Bot 屏幕」面板（T23.18）：经 L1 `groups.list` 窥探 Bot 屏幕能力；
 * 内核未开放时优雅降级为「不支持」提示，绝不报错中断。
 */
export default function BotScreenPanel() {
  const gateway = useGateway();
  const [screens, setScreens] = useState<BotScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await gateway.connect().catch(() => undefined);
      const result = await gateway.request("groups.list", {});
      setScreens(normalizeBotScreens(result));
      setSupported(true);
    } catch {
      setScreens([]);
      setSupported(false);
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">{t("botScreen.loading")}</p>;
  }

  return (
    <div className="bot-screen">
      <p className="muted">{t("botScreen.hint")}</p>
      {!supported ? (
        <p className="empty">{t("botScreen.unsupported")}</p>
      ) : screens.length === 0 ? (
        <p className="empty">{t("botScreen.empty")}</p>
      ) : (
        <ul className="toolset-list">
          {screens.map((screen) => (
            <li className="toolset-item" key={screen.name}>
              <span className="skill-name">{screen.name}</span>
              {screen.status ? <span className="skill-desc muted">{screen.status}</span> : null}
              {screen.detail ? <span className="skill-desc muted">{screen.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
