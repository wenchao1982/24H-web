import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { invokeSkill, type SkillUiInfo } from "./skillhost";

const PROTOCOL = "24os-skill-ui/1";

interface RpcMessage {
  __24os?: boolean;
  type?: string;
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
}

type HostReply =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: string; message: string } };

export interface SkillHostProps {
  skill: SkillUiInfo;
  onClose?: () => void;
}

function randomNonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2);
}

/**
 * 命令式 Skill UI 宿主（`24os-skill-ui/1` 最小实现）：
 * 沙箱 iframe（`sandbox="allow-scripts"`，无 same-origin）+ postMessage JSON-RPC。
 * 能力请求经 BFF broker 转发；宿主绝不自行执行 skill 代码。
 */
export default function SkillHost({ skill, onClose }: SkillHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nonceRef = useRef<string>(randomNonce());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const reply = useCallback((id: string, payload: HostReply) => {
    iframeRef.current?.contentWindow?.postMessage({ __24os: true, id, ...payload }, "*");
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow || event.source !== iframe.contentWindow) {
        return;
      }
      const data = event.data as RpcMessage | null;
      if (!data || data.__24os !== true) {
        return;
      }

      if (data.type === "ui.ready") {
        setStatus("ready");
        return;
      }

      if (typeof data.id === "string" && typeof data.method === "string") {
        const id = data.id;
        const method = data.method;
        const params = data.params ?? {};
        void (async () => {
          try {
            const result = await invokeSkill(skill.id, method, params);
            reply(id, { ok: true, result });
          } catch (error) {
            setStatus("error");
            reply(id, {
              ok: false,
              error: {
                code: "INVOKE_FAILED",
                message: error instanceof Error ? error.message : "能力调用失败",
              },
            });
          }
        })();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [reply, skill.id]);

  const handleLoad = useCallback(() => {
    setStatus("loading");
    iframeRef.current?.contentWindow?.postMessage(
      {
        __24os: true,
        type: "host.init",
        payload: {
          protocol: PROTOCOL,
          capabilities: skill.capabilities,
          permissions: skill.permissions,
          sessionNonce: nonceRef.current,
        },
      },
      "*",
    );
  }, [skill.capabilities, skill.permissions]);

  return (
    <section className="card skill-host" aria-label={t("skillhost.aria", { title: skill.title })}>
      <header className="skill-host-head">
        <h3>{skill.title}</h3>
        <span className="skill-desc muted">
          {status === "ready"
            ? t("skillhost.ready")
            : status === "error"
              ? t("skillhost.error")
              : t("skillhost.loading")}
        </span>
        {onClose ? (
          <button
            type="button"
            className="ghost"
            aria-label={t("skillhost.close")}
            onClick={onClose}
          >
            ✕
          </button>
        ) : null}
      </header>
      <iframe
        ref={iframeRef}
        className="skill-host-frame"
        title={skill.title}
        src={`/skill-ui/${skill.id}/${skill.entry}`}
        sandbox="allow-scripts"
        width={skill.size?.width ?? 720}
        height={skill.size?.height ?? 480}
        onLoad={handleLoad}
      />
    </section>
  );
}
