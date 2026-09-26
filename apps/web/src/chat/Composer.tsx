import { useState } from "react";

export interface ComposerProps {
  onSend: (text: string) => void;
}

export default function Composer({ onSend }: ComposerProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text) {
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
      <button type="submit" className="primary composer-send" aria-label="发送" disabled={draft.trim() === ""}>
        发送
      </button>
    </form>
  );
}
