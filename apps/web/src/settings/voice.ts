/**
 * 设置 → 高级 → 语音：L1 `voice.*` / `wake.*` 状态与参数解析。
 *
 * 字段以官方契约为准，缺失即降级。
 */

export interface VoiceStatus {
  available: boolean;
  wake: boolean;
  listening: boolean;
  voice?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function voiceStatusParams(): Record<string, unknown> {
  return {};
}

export function wakeParams(enabled: boolean): Record<string, unknown> {
  return { enabled };
}

export function ttsParams(text: string): Record<string, unknown> {
  return { text };
}

/** 容错解析 `voice.status` 返回。 */
export function normalizeVoiceStatus(payload: unknown): VoiceStatus {
  if (!payload || typeof payload !== "object") {
    return { available: false, wake: false, listening: false };
  }
  const record = payload as Record<string, unknown>;
  const raw = String(record.status ?? "").toLowerCase();
  const available =
    record.available !== false &&
    (record.available === true ||
      record.enabled === true ||
      record.active === true ||
      record.wake === true ||
      record.wake_word === true ||
      record.listening === true ||
      raw !== "");
  const status: VoiceStatus = {
    available,
    wake: record.wake === true || record.wake_word === true || raw.includes("wake"),
    listening: record.listening === true || record.active === true || raw.includes("listen"),
  };
  const voice = str(record.voice) ?? str(record.provider) ?? str(record.engine);
  if (voice) {
    status.voice = voice;
  }
  return status;
}

/** 提取 `voice.tts` 返回的可播放地址（若有）。 */
export function normalizeTtsResult(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim() !== "") {
    return payload.trim();
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return (
      str(record.url) ??
      str(record.audio_url) ??
      str(record.audio) ??
      (str(record.b64_json) ? `data:audio/mpeg;base64,${record.b64_json}` : null)
    );
  }
  return null;
}
