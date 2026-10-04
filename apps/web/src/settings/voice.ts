/**
 * 设置 → 语音：L1 `wake.*` / `voice.tts` 状态与参数解析（契约见 Hermes `prompt_voice.py`）。
 * 字段以官方为准，缺失即降级。
 *
 * 注：`voice.status` / `wake.set` **不是方法**（前者是事件）；唤醒态用 `wake.status`，
 * 开关用 `wake.start` / `wake.stop`。
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

/** `wake.status` 入参（`surface` 标识调用方）。 */
export function wakeStatusParams(): Record<string, unknown> {
  return { surface: "gui" };
}

/** `wake.start`：arm 监听；`persist` 同时写 `wake_word.enabled`。 */
export function wakeStartParams(): Record<string, unknown> {
  return { surface: "gui", persist: true };
}

/** `wake.stop`：停止监听；`persist` 写 `wake_word.enabled: false`。 */
export function wakeStopParams(): Record<string, unknown> {
  return { persist: true };
}

export function ttsParams(text: string): Record<string, unknown> {
  return { text };
}

/** 容错解析 `wake.status`（`WakeStatusResult`）：`enabled`=配置态、`listening`=本调用方是否已 arm。 */
export function normalizeVoiceStatus(payload: unknown): VoiceStatus {
  if (!payload || typeof payload !== "object") {
    return { available: false, wake: false, listening: false };
  }
  const record = payload as Record<string, unknown>;
  const status: VoiceStatus = {
    available: record.available !== false && record.available === true,
    wake: record.enabled === true,
    listening: record.listening === true,
  };
  const voice = str(record.provider) ?? str(record.phrase);
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
