/**
 * 通知偏好（本地）：启用/提示音/免打扰，持久化到 localStorage。
 * 仅影响客户端铃铛行为，无后端依赖。
 */

export interface NotificationPreferences {
  /** 总开关；关闭后不显示未读徽标。 */
  enabled: boolean;
  /** 新通知到达时播放提示音。 */
  sound: boolean;
  /** 免打扰；隐藏未读徽标。 */
  dnd: boolean;
}

export const NOTIFICATION_PREFS_KEY = "24h.notifications";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: true,
  sound: false,
  dnd: false,
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeNotificationPrefs(value: unknown): NotificationPreferences {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    enabled: bool(raw.enabled, DEFAULT_NOTIFICATION_PREFS.enabled),
    sound: bool(raw.sound, DEFAULT_NOTIFICATION_PREFS.sound),
    dnd: bool(raw.dnd, DEFAULT_NOTIFICATION_PREFS.dnd),
  };
}

export function readNotificationPrefs(
  storage: Storage | undefined = globalThis.localStorage,
): NotificationPreferences {
  if (!storage) {
    return DEFAULT_NOTIFICATION_PREFS;
  }
  try {
    const raw = storage.getItem(NOTIFICATION_PREFS_KEY);
    return raw ? normalizeNotificationPrefs(JSON.parse(raw)) : DEFAULT_NOTIFICATION_PREFS;
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function storeNotificationPrefs(
  prefs: NotificationPreferences,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 存储不可用时忽略
  }
}

/** 未读徽标是否可见：启用且非免打扰。 */
export function badgeVisible(prefs: NotificationPreferences): boolean {
  return prefs.enabled && !prefs.dnd;
}

/** 播放提示音（无 WebAudio 时静默降级）。 */
export function playNotificationSound(): void {
  try {
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) {
      return;
    }
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // 音频不可用时忽略
  }
}
