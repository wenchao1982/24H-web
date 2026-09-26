import { useState } from "react";
import { requestOptions, requestPrompt, type PendingRequest, type RequestKind } from "./types";

const KIND_LABEL: Record<RequestKind, string> = {
  approval: "审批请求",
  clarify: "需要澄清",
  sudo: "需要提权",
  secret: "需要密钥",
  "mcp.setup": "MCP 设置",
};

const APPROVAL_LABELS: Record<string, string> = {
  once: "允许一次",
  session: "本次会话允许",
  always: "始终允许",
  deny: "拒绝",
};

const APPROVAL_DEFAULT = ["once", "session", "always", "deny"].map((value) => ({
  value,
  label: APPROVAL_LABELS[value] ?? value,
}));

/** 依据请求类型把某个选项值包装成回包载荷。 */
function choiceResult(kind: RequestKind, value: string): Record<string, unknown> {
  return kind === "clarify" ? { answer: value } : { choice: value };
}

export interface ServerRequestCardProps {
  request: PendingRequest;
  onRespond: (result: Record<string, unknown>) => void;
}

export default function ServerRequestCard({ request, onRespond }: ServerRequestCardProps) {
  const [text, setText] = useState("");
  const prompt = requestPrompt(request.params);

  if (request.answered) {
    return (
      <div className="server-card" data-kind={request.kind} data-answered="true">
        <span className="server-kind">{KIND_LABEL[request.kind]}</span>
        <span className="server-answered">已回复{request.answer ? `：${request.answer}` : ""}</span>
      </div>
    );
  }

  const options =
    requestOptions(request.params) ?? (request.kind === "approval" ? APPROVAL_DEFAULT : []);
  const freeText = options.length === 0;

  return (
    <div className="server-card" data-kind={request.kind} role="group" aria-label={KIND_LABEL[request.kind]}>
      <span className="server-kind">{KIND_LABEL[request.kind]}</span>
      {prompt ? <p className="server-prompt">{prompt}</p> : null}

      {options.length > 0 ? (
        <div className="server-actions">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="ghost"
              onClick={() => onRespond(choiceResult(request.kind, option.value))}
            >
              {request.kind === "approval"
                ? (APPROVAL_LABELS[option.value] ?? option.label)
                : option.label}
            </button>
          ))}
        </div>
      ) : freeText ? (
        <form
          className="server-actions"
          onSubmit={(event) => {
            event.preventDefault();
            const value = text.trim();
            if (value) {
              onRespond(request.kind === "mcp.setup" ? { approved: true } : { value });
            }
          }}
        >
          <input
            className="server-input"
            aria-label={`${KIND_LABEL[request.kind]}输入`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" className="primary">
            提交
          </button>
        </form>
      ) : null}
    </div>
  );
}
