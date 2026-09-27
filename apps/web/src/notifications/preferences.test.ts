import { afterEach, describe, expect, it } from "vitest";
import {
  badgeVisible,
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  NOTIFICATION_PREFS_KEY,
  readNotificationPrefs,
  storeNotificationPrefs,
} from "./preferences";

afterEach(() => {
  localStorage.clear();
});

describe("notifications preferences", () => {
  it("defaults and round-trips through localStorage", () => {
    expect(readNotificationPrefs()).toEqual(DEFAULT_NOTIFICATION_PREFS);
    storeNotificationPrefs({ enabled: false, sound: true, dnd: true });
    expect(JSON.parse(localStorage.getItem(NOTIFICATION_PREFS_KEY) ?? "{}")).toEqual({
      enabled: false,
      sound: true,
      dnd: true,
    });
    expect(readNotificationPrefs()).toEqual({ enabled: false, sound: true, dnd: true });
  });

  it("normalizes invalid / partial stored values", () => {
    expect(normalizeNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(normalizeNotificationPrefs({ dnd: true })).toEqual({
      enabled: true,
      sound: false,
      dnd: true,
    });
    expect(normalizeNotificationPrefs({ enabled: "yes", sound: 1, dnd: false })).toEqual({
      enabled: true,
      sound: false,
      dnd: false,
    });
  });

  it("hides the badge when disabled or in DND", () => {
    expect(badgeVisible({ enabled: true, sound: false, dnd: false })).toBe(true);
    expect(badgeVisible({ enabled: false, sound: false, dnd: false })).toBe(false);
    expect(badgeVisible({ enabled: true, sound: false, dnd: true })).toBe(false);
  });
});
