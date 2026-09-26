/** 外观主题：日/夜/跟随系统，持久化到 localStorage 并应用到 `data-theme`。 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "24h.theme";

export const THEMES: Theme[] = ["light", "dark", "system"];

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(storage: Storage | undefined = globalThis.localStorage): Theme {
  if (!storage) {
    return "system";
  }
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function storeTheme(
  theme: Theme,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 存储不可用时忽略
  }
}

export function prefersDark(
  matchMedia: typeof window.matchMedia | undefined = globalThis.window?.matchMedia,
): boolean {
  return Boolean(matchMedia?.("(prefers-color-scheme: dark)").matches);
}

export function resolveTheme(
  theme: Theme,
  prefersDarkValue: boolean = prefersDark(),
): ResolvedTheme {
  if (theme === "system") {
    return prefersDarkValue ? "dark" : "light";
  }
  return theme;
}

/** 把解析后的主题写入 `<html data-theme>`。 */
export function applyTheme(
  theme: Theme,
  root: HTMLElement | undefined = globalThis.document?.documentElement,
): ResolvedTheme {
  const resolved = resolveTheme(theme);
  if (root) {
    root.dataset.theme = resolved;
  }
  return resolved;
}
