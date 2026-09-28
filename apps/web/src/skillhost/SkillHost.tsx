import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { Tag, type TagTone } from "../ui";
import { invokeSkill, type SkillUiInfo } from "./skillhost";

const PROTOCOL = "24os-skill-ui/1";

export type SkillHostStatus = "loading" | "ready" | "error";

export interface SkillHostLogEntry {
  dir: "in" | "out";
  text: string;
}

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
  onStatus?: (status: SkillHostStatus) => void;
  onLog?: (entry: SkillHostLogEntry) => void;
  previewWidth?: number | "fill";
}

function randomNonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2);
}

const STATUS_TONE: Record<SkillHostStatus, TagTone> = {
  ready: "success",
  loading: "info",
  error: "danger",
};

const STATUS_KEY: Record<SkillHostStatus, "skillhost.ready" | "skillhost.loading" | "skillhost.error"> = {
  ready: "skillhost.ready",
  loading: "skillhost.loading",
  error: "skillhost.error",
};

/**
 * 命令式 Skill UI 宿主（`24os-skill-ui/1` 最小实现）：
 * 沙箱 iframe（`sandbox="allow-scripts"`，无 same-origin）+ postMessage JSON-RPC。
 * 能力请求经 BFF broker 转发；宿主绝不自行执行 skill 代码。
 */
export default function SkillHost({
  skill,
  onClose,
  onStatus,
  onLog,
  previewWidth,
}: SkillHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nonceRef = useRef<string>(randomNonce());
  const [status, setStatus] = useState<SkillHostStatus>("loading");

  const onStatusRef = useRef(onStatus);
  const onLogRef = useRef(onLog);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  useEffect(() => {
    onStatusRef.current?.(status);
  }, [status]);

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
        onLogRef.current?.({ dir: "in", text: "ui.ready" });
        setStatus("ready");
        return;
      }

      if (typeof data.id === "string" && typeof data.method === "string") {
        const id = data.id;
        const method = data.method;
        const params = data.params ?? {};
        onLogRef.current?.({ dir: "in", text: method });
        void (async () => {
          try {
            const result = await invokeSkill(skill.id, method, params);
            onLogRef.current?.({ dir: "out", text: `${method} → ok` });
            reply(id, { ok: true, result });
          } catch (error) {
            const message = error instanceof Error ? error.message : "能力调用失败";
            setStatus("error");
            onLogRef.current?.({ dir: "out", text: `${method} → error: ${message}` });
            reply(id, {
              ok: false,
              error: {
                code: "INVOKE_FAILED",
                message,
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
    onLogRef.current?.({ dir: "out", text: "host.init" });
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

  const frameWidth = previewWidth ?? skill.size?.width ?? 720;

  return (
    <section className="card skill-host" aria-label={t("skillhost.aria", { title: skill.title })}>
      <header className="skill-host-head">
        <h3>{skill.title}</h3>
        <Tag tone={STATUS_TONE[status]}>{t(STATUS_KEY[status])}</Tag>
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
      <div className="skill-sandbox">
        <iframe
          ref={iframeRef}
          className="skill-host-frame"
          title={skill.title}
          src={`/skill-ui/${skill.id}/${skill.entry}`}
          sandbox="allow-scripts"
          width={frameWidth === "fill" ? "100%" : frameWidth}
          height={skill.size?.height ?? 480}
          onLoad={handleLoad}
        />
        {status === "loading" ? (
          <div className="skill-sandbox-overlay" aria-hidden="true">
            <span className="skill-sandbox-spinner" />
            <span>{t("skillhost.sandboxLoading")}</span>
          </div>
        ) : null}
        {status === "error" ? (
          <div className="skill-sandbox-overlay" role="alert">
            <span>{t("skillhost.sandboxError")}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
