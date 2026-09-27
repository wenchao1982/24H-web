import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { useGateway } from "./GatewayProvider";
import type { Attachment } from "./types";
import { filterCommands, parseSlash, type SlashCommand } from "./slash";
import { buildMessage, normalizePathSuggestions, type PathSuggestion } from "./references";
import SlashMenu from "./SlashMenu";
import ReferenceMenu from "./ReferenceMenu";

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
  const gateway = useGateway();
  const [draft, setDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [references, setReferences] = useState<string[]>([]);
  const [pathMatches, setPathMatches] = useState<PathSuggestion[]>([]);
  const [pathIndex, setPathIndex] = useState(0);
  const [pathDismissed, setPathDismissed] = useState(false);

  const slashQuery = draft.startsWith("/") && !/\s/.test(draft) ? draft.slice(1) : null;
  const matches = useMemo(
    () => (slashQuery === null ? [] : filterCommands(commands, slashQuery).slice(0, 8)),
    [commands, slashQuery],
  );
  const menuOpen = !dismissed && slashQuery !== null && commands.length > 0;

  const pathQuery = draft.startsWith("@") && !/\s/.test(draft) ? draft.slice(1) : null;
  const pathMenuOpen = !pathDismissed && pathQuery !== null;

  // T23.2 `@` 引用：查询 `complete.path`，结果作为候选。
  useEffect(() => {
    if (pathQuery === null) {
      setPathMatches([]);
      return;
    }
    let alive = true;
    void gateway
      .connect()
      .catch(() => undefined)
      .then(() => gateway.request("complete.path", { prefix: pathQuery }))
      .then((result) => {
        if (alive) {
          setPathMatches(normalizePathSuggestions(result).slice(0, 8));
        }
      })
      .catch(() => {
        if (alive) {
          setPathMatches([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [gateway, pathQuery]);

  const resetMenu = () => {
    setDismissed(false);
    setActiveIndex(0);
    setPathDismissed(false);
    setPathIndex(0);
  };

  const addReference = (path: string) => {
    setReferences((current) => (current.includes(path) ? current : [...current, path]));
    setDraft("");
    resetMenu();
  };

  const removeReference = (path: string) => {
    setReferences((current) => current.filter((entry) => entry !== path));
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
    if ((!text && references.length === 0) || running) {
      return;
    }
    const slash = parseSlash(text);
    if (slash && commands.some((command) => `/${command.name}` === slash.command)) {
      runCommand(slash.command.slice(1), slash.args);
      return;
    }
    setDraft("");
    resetMenu();
    const message = buildMessage(text, references);
    setReferences([]);
    onSend(message);
  };

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {references.length > 0 ? (
        <div className="attachments references" aria-label={t("reference.menu")}>
          {references.map((path) => (
            <span key={path} className="attachment-chip">
              @{path}
              <button
                type="button"
                className="attachment-remove"
                aria-label={t("reference.remove", { path })}
                onClick={() => removeReference(path)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

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

      {pathMenuOpen ? (
        <div className="composer-slash composer-reference">
          {pathMatches.length > 0 ? (
            <ReferenceMenu paths={pathMatches} activeIndex={pathIndex} onPick={addReference} />
          ) : (
            <p className="slash-empty muted">{t("reference.empty")}</p>
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
          setPathDismissed(false);
          setPathIndex(0);
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
          if (pathMenuOpen && pathMatches.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setPathIndex((current) => (current + 1) % pathMatches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setPathIndex((current) => (current - 1 + pathMatches.length) % pathMatches.length);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setPathDismissed(true);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey && !running) {
              event.preventDefault();
              const selected = pathMatches[pathIndex] ?? pathMatches[0];
              if (selected) {
                addReference(selected.path);
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
          disabled={draft.trim() === "" && references.length === 0}
        >
          发送
        </button>
      )}
    </form>
  );
}
