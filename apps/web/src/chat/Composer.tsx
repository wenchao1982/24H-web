import { useState } from "react";
import type { Attachment } from "./types";

export interface ComposerProps {
  onSend: (text: string) => void;
  running?: boolean;
  onStop?: () => void;
  attachments?: Attachment[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
}

export default function Composer({
  onSend,
  running = false,
  onStop,
  attachments = [],
  onAttach,
  onRemoveAttachment,
}: ComposerProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text || running) {
      return;
    }
    setDraft("");
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

      <textarea
        className="composer-input"
        aria-label="消息"
        placeholder="输入消息，Enter 发送"
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
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
