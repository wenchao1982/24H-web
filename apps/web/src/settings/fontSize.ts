/** 正文字号：12–17px，持久化到 localStorage 并写入 `--ds-font-size*`。 */

export const FONT_SIZE_KEY = "24h.fontSize";
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 17;
export const DEFAULT_FONT_SIZE = 14;

export function readStoredFontSize(storage: Storage | undefined = globalThis.localStorage): number {
  if (!storage) {
    return DEFAULT_FONT_SIZE;
  }
  try {
    const raw = storage.getItem(FONT_SIZE_KEY);
    if (raw === null || raw.trim() === "") {
      return DEFAULT_FONT_SIZE;
    }
    const value = Number(raw);
    return Number.isFinite(value)
      ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)))
      : DEFAULT_FONT_SIZE;
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

export function storeFontSize(
  size: number,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(FONT_SIZE_KEY, String(size));
  } catch {
    // 存储不可用时忽略
  }
}

/** 把字号写入根 token（正文 / 小号 / 更小号各差 1px）。 */
export function applyFontSize(
  size: number,
  root: HTMLElement | undefined = globalThis.document?.documentElement,
): void {
  if (!root) {
    return;
  }
  root.style.setProperty("--ds-font-size", `${size}px`);
  root.style.setProperty("--ds-font-size-sm", `${size - 1}px`);
  root.style.setProperty("--ds-font-size-xs", `${size - 2}px`);
}
