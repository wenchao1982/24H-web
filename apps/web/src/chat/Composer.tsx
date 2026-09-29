import { useEffect, useMemo, useState, type ReactNode } from "react";
import { t } from "../i18n";
import { useGateway } from "./GatewayProvider";
import { filterCommands, parseSlash, type SlashCommand } from "./slash";
import { buildMessage, normalizePathSuggestions, type PathSuggestion } from "./references";
import SlashMenu from "./SlashMenu";
import ReferenceMenu from "./ReferenceMenu";

/** 附件 chip 的最小结构（含 `Attachment` / `PendingAttachment` 的公共字段）。 */
export interface ComposerChip {
  id: string;
  name: string;
  previewUrl?: string;
}

/** 控件插槽渲染参数：`canSend` 汇总草稿/引用/附件，`submit` 触发同一条发送路径。 */
export interface ComposerControlsSlotArgs {
  canSend: boolean;
  submit: () => void;
}

export interface ComposerProps {
  onSend: (text: string) => void | boolean | Promise<void | boolean>;
  running?: boolean;
  onStop?: () => void;
  attachments?: ComposerChip[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  /** 可用 slash 命令（来自 commands.catalog）。 */
  commands?: SlashCommand[];
  /** 执行 slash 命令（T20.1）。 */
  onSlash?: (command: string, args: string) => void;
  /** hero/docked 双态（同一实例，仅以 `data-variant` 切布局；默认 docked）。 */
  variant?: "hero" | "docked";
  /** 控件区渲染插槽（`ComposerControls`）；提供时替代内置的 ＋ / 发送行。 */
  controls?: (args: ComposerControlsSlotArgs) => ReactNode;
  /** 拖拽 / 粘贴附件回调（浏览器 File API，非 `clipboard.paste`）。 */
  onAttachFiles?: (files: File[]) => void;
  /** 附件数量（用于发送守卫；缺省取 `attachments.length`）。 */
  attachmentCount?: number;
}

const DROP_HINT_ID = "composer-drop-hint";

export default function Composer({
  onSend,
  running = false,
  onStop,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  commands = [],
  onSlash,
  variant = "docked",
  controls,
  onAttachFiles,
  attachmentCount,
}: ComposerProps) {
  const gateway = useGateway();
  const [draft, setDraft] = useState("");
  const [dragover, setDragover] = useState(false);
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

  const totalAttachments = attachmentCount ?? attachments.length;
  const canSend = !(draft.trim() === "" && references.length === 0 && totalAttachments === 0);

  const submit = () => {
    const text = draft.trim();
    if ((!text && references.length === 0 && totalAttachments === 0) || running) {
      return;
    }
    const slash = parseSlash(text);
    if (slash && commands.some((command) => `/${command.name}` === slash.command)) {
      runCommand(slash.command.slice(1), slash.args);
      return;
    }
    const message = buildMessage(text, references);
    const prevDraft = draft;
    const prevRefs = references;
    setDraft("");
    resetMenu();
    setReferences([]);
    const outcome = onSend(message);
    // 失败（resolve false / reject）时还原草稿与引用；成功发送保持清空。
    if (outcome && typeof (outcome as Promise<unknown>).then === "function") {
      void (outcome as Promise<unknown>)
        .then((ok) => {
          if (ok === false) {
            setDraft(prevDraft);
            setReferences(prevRefs);
          }
        })
        .catch(() => {
          setDraft(prevDraft);
          setReferences(prevRefs);
        });
    }
  };

  return (
    <form
      className="composer attach-dropzone"
      data-variant={variant}
      data-dragover={dragover}
      aria-describedby={DROP_HINT_ID}
      onDragOver={(event) => {
        event.preventDefault();
        setDragover(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setDragover(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragover(false);
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length > 0) {
          onAttachFiles?.(files);
        }
      }}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length > 0) {
          event.preventDefault();
          onAttachFiles?.(files);
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <span id={DROP_HINT_ID} className="visually-hidden">
        {t("composer.attach.dropHint")}
      </span>
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
              {attachment.previewUrl ? (
                <img
                  className="attachment-thumb"
                  src={attachment.previewUrl}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
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

      {controls ? (
        controls({ canSend, submit })
      ) : (
        <>
          <label className="icon-btn composer-attach">
            <input
              type="file"
              multiple
              className="composer-file"
              aria-label="添加附件"
              aria-describedby={DROP_HINT_ID}
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
            <button
              type="button"
              className="primary composer-stop"
              aria-label="停止"
              onClick={onStop}
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              className="primary composer-send"
              aria-label="发送"
              disabled={!canSend}
            >
              发送
            </button>
          )}
        </>
      )}
    </form>
  );
}
