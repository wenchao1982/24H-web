import { useCallback, useEffect, useRef, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";

export interface UseVoiceOptions {
  /** 当前会话 runtime id（`voice.status`/`voice.transcript` 寻址；可空）。 */
  sessionId?: () => string | null;
  /** 捕获到语音文本（用于填入 / 直接发送）。 */
  onTranscript: (text: string) => void;
}

export interface VoiceController {
  listening: boolean;
  toggle: () => void;
  stop: () => void;
  /** TTS 朗读（`voice.tts`）；打断由 `voice.interrupted` 事件处理。 */
  speak: (text: string) => void;
}

/**
 * 语音输入（M19）：按住说话 STT。
 * - `voice.record { action: start|stop, session_id? }` 控制录音（VAD 有界）。
 * - 文本经 `voice.transcript` 事件到达 → `onTranscript`。
 * - `voice.status` / `voice.interrupted` 同步聆听态（打断即停）。
 * 契约见 Hermes `prompt_voice.py` / `events.py`。
 */
export function useVoice({ sessionId, onTranscript }: UseVoiceOptions): VoiceController {
  const gateway = useGateway();
  const [listening, setListening] = useState(false);
  const handler = useRef(onTranscript);
  handler.current = onTranscript;

  useEffect(() => {
    const unsubscribes = [
      gateway.on("voice.status", (payload) => {
        const state = typeof payload.state === "string" ? payload.state : "";
        setListening(state === "recording" || state === "listening");
      }),
      gateway.on("voice.transcript", (payload) => {
        if (payload.stop_phrase === true) {
          return;
        }
        const text = typeof payload.text === "string" ? payload.text.trim() : "";
        if (text) {
          handler.current(text);
        }
      }),
      gateway.on("voice.interrupted", () => setListening(false)),
    ];
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [gateway]);

  const record = useCallback(
    (action: "start" | "stop") => {
      const sid = sessionId?.() ?? null;
      void gateway
        .connect()
        .catch(() => undefined)
        .then(() =>
          gateway.request<{ status?: string }>("voice.record", {
            action,
            ...(sid ? { session_id: sid } : {}),
          }),
        )
        .then((result) => setListening(action === "start" && result?.status === "recording"))
        .catch(() => setListening(false));
    },
    [gateway, sessionId],
  );

  const toggle = useCallback(() => {
    setListening((current) => {
      record(current ? "stop" : "start");
      return !current;
    });
  }, [record]);

  const stop = useCallback(() => {
    setListening(false);
    record("stop");
  }, [record]);

  const speak = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      const sid = sessionId?.() ?? null;
      void gateway
        .connect()
        .catch(() => undefined)
        .then(() =>
          gateway.request("voice.tts", {
            text: trimmed,
            ...(sid ? { session_id: sid } : {}),
          }),
        )
        .catch(() => undefined);
    },
    [gateway, sessionId],
  );

  return { listening, toggle, stop, speak };
}
