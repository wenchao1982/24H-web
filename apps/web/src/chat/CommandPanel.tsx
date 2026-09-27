import { useCallback, useMemo, useState } from "react";
import { useGateway } from "./GatewayProvider";
import { t } from "../i18n";
import { SLASH_COMMAND_SPECS, specForCommand, type SlashActionSpec } from "./commandSpecs";
import { slashResultText } from "./slash";

export interface CommandPanelProps {
  onClose?: () => void;
  /** 命令执行完成后回调（用于把结果追加到 transcript）。 */
  onResult?: (text: string) => void;
}

/** 会话命令面板（T20.2+）：选择命令 → 预设动作/参数 → `slash.exec` → 展示结果。 */
export default function CommandPanel({ onClose, onResult }: CommandPanelProps) {
  const gateway = useGateway();
  const [command, setCommand] = useState(SLASH_COMMAND_SPECS[0]?.command ?? "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);

  const spec = useMemo(() => specForCommand(command), [command]);

  const run = useCallback(
    async (args: string) => {
      setBusy(true);
      setError(null);
      try {
        const payload = await gateway.request("slash.exec", { command: `/${command}`, args });
        const text = slashResultText(payload) || t("slash.done", { command: `/${command}` });
        setResult(text);
        onResult?.(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("cmd.error"));
      } finally {
        setBusy(false);
      }
    },
    [command, gateway, onResult],
  );

  const runAction = (action: SlashActionSpec) => {
    const value = action.withInput ? input.trim() : "";
    if (action.withInput && value === "") {
      return;
    }
    void run(action.withInput ? `${action.args} ${value}`.trim() : action.args);
  };

  return (
    <div className="card command-panel">
      <div className="command-panel-head">
        <h3>{t("cmd.panel")}</h3>
        {onClose ? (
          <button type="button" className="ghost" aria-label={t("cmd.close")} onClick={onClose}>
            ✕
          </button>
        ) : null}
      </div>

      <label className="command-row">
        <span className="muted">{t("cmd.select")}</span>
        <select
          aria-label={t("cmd.select")}
          value={command}
          onChange={(event) => {
            setCommand(event.target.value);
            setInput("");
            setResult("");
            setError(null);
          }}
        >
          {SLASH_COMMAND_SPECS.map((item) => (
            <option key={item.command} value={item.command}>
              /{item.command} · {t(item.titleKey)}
            </option>
          ))}
        </select>
      </label>

      {spec ? (
        <>
          <div className="command-actions">
            {spec.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={
                  action.kind === "primary" ? "primary" : action.kind === "danger" ? "danger" : "ghost"
                }
                disabled={busy || (action.withInput === true && input.trim() === "")}
                onClick={() => runAction(action)}
              >
                {t(action.labelKey)}
              </button>
            ))}
          </div>
          {spec.inputKey ? (
            <div className="row">
              <input
                aria-label={t(spec.inputKey)}
                placeholder={t(spec.inputKey)}
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <pre className="command-result" aria-label={t("cmd.result")}>
          {result}
        </pre>
      ) : null}
    </div>
  );
}
