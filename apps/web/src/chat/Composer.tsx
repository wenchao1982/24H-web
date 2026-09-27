import { useMemo, useState } from "react";
import { t } from "../i18n";
import type { Attachment } from "./types";
import { filterCommands, parseSlash, type SlashCommand } from "./slash";
import SlashMenu from "./SlashMenu";

export interface ComposerProps {
  onSend: (text: string) => void;
  running?: boolean;
  onStop?: () => void;
  attachments?: Attachment[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  /** 可用 slash 命令（来自 commands.catalog）。 */
  commands?: SlashCommand[];
  /** 执行 slash 命令（T20.1）。 */
  onSlash?: (command: string, args: string) => void;
}

export default function Composer({
  onSend,
  running = false,
  onStop,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  commands = [],
  onSlash,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const slashQuery = draft.startsWith("/") && !/\s/.test(draft) ? draft.slice(1) : null;
  const matches = useMemo(
    () => (slashQuery === null ? [] : filterCommands(commands, slashQuery).slice(0, 8)),
    [commands, slashQuery],
  );
  const menuOpen = !dismissed && slashQuery !== null && commands.length > 0;

  const resetMenu = () => {
    setDismissed(false);
    setActiveIndex(0);
  };

  const runCommand = (command: string, args: string) => {
    setDraft("");
    resetMenu();
    onSlash?.(command, args);
  };

  const pick = (command: SlashCommand) => {
    const args = parseSlash(draft)?.args ?? "";
    runCommand(command.name, args);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || running) {
      return;
    }
    const slash = parseSlash(text);
    if (slash && commands.some((command) => `/${command.name}` === slash.command)) {
      runCommand(slash.command.slice(1), slash.args);
      return;
    }
    setDraft("");
    resetMenu();
    onSend(text);
  };

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 ? (
        <div className="attachments">
          {attachments.map((attachment) => (
            <span key={attachment.id} className="attachment-chip">
              {attachment.name}
              <button
                type="button"
                className="attachment-remove"
                aria-label={`移除 ${attachment.name}`}
                onClick={() => onRemoveAttachment?.(attachment.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {menuOpen ? (
        <div className="composer-slash">
          {matches.length > 0 ? (
            <SlashMenu commands={matches} activeIndex={activeIndex} onPick={pick} />
          ) : (
            <p className="slash-empty muted">{t("slash.empty")}</p>
          )}
        </div>
      ) : null}

      <textarea
        className="composer-input"
        aria-label="消息"
        placeholder={t("slash.hint")}
        rows={2}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setDismissed(false);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (menuOpen && matches.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % matches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + matches.length) % matches.length);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDismissed(true);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey && !running) {
              event.preventDefault();
              const selected = matches[activeIndex] ?? matches[0];
              if (selected) {
                pick(selected);
              }
              return;
            }
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />

      <label className="icon-btn composer-attach">
        <input
          type="file"
          multiple
          className="composer-file"
          aria-label="添加附件"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) {
              onAttach?.(files);
            }
            event.target.value = "";
          }}
        />
        ＋
      </label>

      {running ? (
        <button type="button" className="primary composer-stop" aria-label="停止" onClick={onStop}>
          停止
        </button>
      ) : (
        <button
          type="submit"
          className="primary composer-send"
          aria-label="发送"
          disabled={draft.trim() === ""}
        >
          发送
        </button>
      )}
    </form>
  );
}
