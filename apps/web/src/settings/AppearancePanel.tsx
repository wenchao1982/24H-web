import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, storeTheme, THEMES, type Theme } from "./theme";
import {
  applyFontSize,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  readStoredFontSize,
  storeFontSize,
} from "./fontSize";

const LABELS: Record<Theme, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};

/** 设置 → 外观：浅色 / 深色 / 跟随系统，持久化并应用 `data-theme`。 */
export default function AppearancePanel() {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [fontSize, setFontSize] = useState<number>(() => readStoredFontSize());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  const choose = (next: Theme) => {
    setTheme(next);
    storeTheme(next);
    applyTheme(next);
  };

  return (
    <div className="settings-section">
      <div className="card">
        <h3>外观</h3>
        <div className="segmented" role="radiogroup" aria-label="外观主题">
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              className="segmented-btn"
              aria-checked={theme === option}
              data-active={theme === option}
              onClick={() => choose(option)}
            >
              {LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>字号</h3>
        <div className="row">
          <input
            type="range"
            aria-label="正文字号"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            value={fontSize}
            onChange={(event) => {
              const next = Number(event.target.value);
              setFontSize(next);
              storeFontSize(next);
              applyFontSize(next);
            }}
          />
          <span className="muted">
            {fontSize}px（{FONT_SIZE_MIN}–{FONT_SIZE_MAX}）
          </span>
        </div>
      </div>
    </div>
  );
}
