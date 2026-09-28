import { useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { ConfirmDialog } from "../ui";
import { execMethod, execParams, normalizeExecOutput, type ExecKind } from "./exec";

/** 设置 → 高级 → 命令执行：L1 `cli.exec` / `shell.exec`（执行前确认）。 */
export default function ExecPanel() {
  const gateway = useGateway();
  const [kind, setKind] = useState<ExecKind>("cli");
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const run = () => {
    const value = command.trim();
    if (!value) {
      return;
    }
    setPending(value);
  };

  const execute = (value: string) => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const result = await gateway.request(execMethod(kind), execParams(value));
        setOutput(normalizeExecOutput(result));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("exec.error"));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("exec.title")}</h3>
        <p className="muted">{t("exec.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <div className="segmented" role="group" aria-label={t("exec.kindLabel")}>
          <button
            type="button"
            className="segmented-btn"
            data-active={kind === "cli"}
            aria-pressed={kind === "cli"}
            onClick={() => setKind("cli")}
          >
            {t("exec.kind.cli")}
          </button>
          <button
            type="button"
            className="segmented-btn"
            data-active={kind === "shell"}
            aria-pressed={kind === "shell"}
            onClick={() => setKind("shell")}
          >
            {t("exec.kind.shell")}
          </button>
        </div>
        <div className="row">
          <input
            aria-label={t("exec.command")}
            placeholder={t("exec.placeholder")}
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                run();
              }
            }}
          />
          <button
            type="button"
            className="danger"
            disabled={busy || command.trim() === ""}
            aria-label={t("exec.run")}
            onClick={run}
          >
            {t("exec.run")}
          </button>
        </div>
        {output !== null ? <pre className="toolset-config exec-output">{output}</pre> : null}
      </div>

      <ConfirmDialog
        open={pending !== null}
        message={pending !== null ? t("exec.confirm", { command: pending }) : ""}
        confirmLabel="确认执行"
        danger
        onConfirm={() => {
          const value = pending;
          setPending(null);
          if (value !== null) {
            execute(value);
          }
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
