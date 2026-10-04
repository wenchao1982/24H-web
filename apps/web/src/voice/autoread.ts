/** 自动朗读偏好（M19）：本地持久化，助手回合完成后自动 TTS。 */
const KEY = "24h:voice:auto-read";

export function getAutoRead(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoRead(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(KEY, enabled ? "1" : "0");
  } catch {
    // 无 localStorage（SSR/隐私模式）时静默
  }
}
