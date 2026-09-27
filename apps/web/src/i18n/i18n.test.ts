import { describe, expect, it } from "vitest";
import { interpolate, t, zh } from "./index";

describe("i18n t()", () => {
  it("returns the expected Chinese strings", () => {
    expect(t("nav.chat")).toBe("对话");
    expect(t("nav.notifications")).toBe("通知");
    expect(t("settings.section.projects")).toBe("项目");
    expect(t("details.tab.git")).toBe("Git");
  });

  it("stays fully Chinese (no missing / empty entries)", () => {
    for (const value of Object.values(zh)) {
      expect(value.trim()).not.toBe("");
    }
  });

  it("interpolates {{name}} placeholders and keeps unknown ones", () => {
    expect(interpolate("会话操作 {{title}}", { title: "会话一" })).toBe("会话操作 会话一");
    expect(interpolate("选择 {{ title }}", { title: "会话一" })).toBe("选择 会话一");
    expect(interpolate("重命名 {{title}}")).toBe("重命名 {{title}}");
  });
});
