import { useEffect, useRef, useState } from "react";
import { Gateway } from "../api/gateway";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatPage() {
  const gatewayRef = useRef<Gateway | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const gateway = new Gateway();
    gatewayRef.current = gateway;

    gateway.on("message.delta", (payload) => {
      const text = String(payload.text ?? "");
      if (!text) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          return [...prev.slice(0, -1), { role: "assistant", text: last.text + text }];
        }
        return [...prev, { role: "assistant", text }];
      });
    });
    gateway.on("message.complete", () => setBusy(false));
    gateway.on("error", (payload) => {
      setError(String(payload.message ?? "对话出错"));
      setBusy(false);
    });

    gateway.onServerRequest("approval", (params, respond) =>
      respond({ choice: window.confirm(`需要确认：${String(params.description ?? "")}`) ? "once" : "deny" }),
    );
    gateway.onServerRequest("clarify", (params, respond) =>
      respond({ answer: window.prompt(String(params.question ?? "请补充：")) ?? "" }),
    );

    gateway
      .connect()
      .then(() => gateway.request<{ session_id: string }>("session.create"))
      .then((result) => {
        sessionRef.current = result.session_id;
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));

    return () => gateway.close();
  }, []);

  const send = async () => {
    const text = input.trim();
    const gateway = gatewayRef.current;
    const sessionId = sessionRef.current;
    if (!text || !gateway || !sessionId || busy) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      await gateway.request("prompt.submit", { session_id: sessionId, text });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <p className="muted">发一句话开始吧。（连接中会先创建会话）</p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`msg ${message.role}`}>
            {message.text}
          </div>
        ))}
        {error && <div className="err">{error}</div>}
      </div>
      <div className="composer">
        <textarea
          value={input}
          placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button className="primary" type="button" disabled={busy} onClick={() => void send()}>
          {busy ? "生成中…" : "发送"}
        </button>
      </div>
    </div>
  );
}
