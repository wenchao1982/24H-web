import { useState } from "react";
import { requestOptions, requestPrompt, requestResult, type PendingRequest, type RequestKind } from "./types";

const KIND_LABEL: Record<RequestKind, string> = {
  approval: "审批请求",
  clarify: "需要澄清",
  sudo: "需要提权",
  secret: "需要密钥",
  "vault.unlock_prompt": "解锁密码库",
  "vault.save_login": "保存登录",
  "vault.code": "验证码",
  "terminal.read": "读取终端",
  "preview.read": "读取预览",
  "window.read": "读取窗口",
  "preview.act": "操作预览",
  tour: "引导演示",
  "display.install.sudo": "安装授权",
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

/** 单值输入（Hermes `ValueResult`）：密码 / 密钥 / 验证码 / 安装授权。 */
const SECRET_KINDS: RequestKind[] = [
  "sudo",
  "secret",
  "vault.unlock_prompt",
  "vault.code",
  "display.install.sudo",
];

const MASKED_KINDS: RequestKind[] = ["sudo", "secret", "vault.unlock_prompt", "display.install.sudo"];

/** 请求正文里的次要上下文（命令 / 环境变量 / 站点等）。 */
function requestDetail(kind: RequestKind, params: Record<string, unknown>): string | undefined {
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = params[key];
      if (typeof value === "string" && value.trim() !== "") {
        return value;
      }
    }
    return undefined;
  };
  switch (kind) {
    case "approval":
    case "sudo":
      return pick("command", "description");
    case "secret":
      return pick("env_var");
    case "vault.unlock_prompt":
      return pick("display_name", "backend");
    case "vault.save_login":
      return pick("site", "origin");
    case "vault.code":
      return pick("site", "hint");
    case "preview.act":
    case "tour":
      return pick("action", "selector", "title");
    default:
      return undefined;
  }
}

export interface ServerRequestCardProps {
  request: PendingRequest;
  onRespond: (result: Record<string, unknown>) => void;
}

export default function ServerRequestCard({ request, onRespond }: ServerRequestCardProps) {
  const [text, setText] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const kind = request.kind;
  const prompt = requestPrompt(request.params);
  const detail = requestDetail(kind, request.params);

  if (request.answered) {
    return (
      <div className="server-card" data-kind={kind} data-answered="true">
        <span className="server-kind">{KIND_LABEL[kind]}</span>
        <span className="server-answered">已回复{request.answer ? `：${request.answer}` : ""}</span>
      </div>
    );
  }

  const options =
    requestOptions(request.params) ??
    (kind === "approval" ? APPROVAL_DEFAULT : []);

  const body = (() => {
    if (options.length > 0) {
      return (
        <div className="server-actions">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="ghost"
              onClick={() => onRespond(requestResult(kind, option.value))}
            >
              {kind === "approval" ? (APPROVAL_LABELS[option.value] ?? option.label) : option.label}
            </button>
          ))}
        </div>
      );
    }

    if (kind === "vault.save_login") {
      return (
        <form
          className="server-actions"
          onSubmit={(event) => {
            event.preventDefault();
            onRespond({
              value: JSON.stringify({ identifier: identifier.trim(), password: password.trim() }),
            });
          }}
        >
          <input
            className="server-input"
            aria-label="账号"
            placeholder="账号 / 邮箱"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <input
            className="server-input"
            type="password"
            aria-label="密码"
            placeholder="密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" className="primary">
            提交
          </button>
        </form>
      );
    }

    if (SECRET_KINDS.includes(kind) || kind === "clarify") {
      const submit = requestResult(kind, text.trim());
      return (
        <form
          className="server-actions"
          onSubmit={(event) => {
            event.preventDefault();
            onRespond(submit);
          }}
        >
          <input
            className="server-input"
            type={MASKED_KINDS.includes(kind) ? "password" : "text"}
            aria-label={`${KIND_LABEL[kind]}输入`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" className="primary">
            提交
          </button>
          <button type="button" className="ghost" onClick={() => onRespond(requestResult(kind, ""))}>
            跳过
          </button>
        </form>
      );
    }

    // 桥接类：Web 端无法读取本机终端/窗口/预览 → 回空值跳过（`''` = skipped/declined）。
    return (
      <div className="server-actions">
        <button type="button" className="ghost" onClick={() => onRespond(requestResult(kind, ""))}>
          无法处理（跳过）
        </button>
      </div>
    );
  })();

  return (
    <div className="server-card" data-kind={kind} role="group" aria-label={KIND_LABEL[kind]}>
      <span className="server-kind">{KIND_LABEL[kind]}</span>
      {prompt ? <p className="server-prompt">{prompt}</p> : null}
      {detail ? <pre className="server-prompt server-detail">{detail}</pre> : null}
      {body}
    </div>
  );
}
