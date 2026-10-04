import { t } from "../i18n";
import { BrandMark } from "../ui/icons";
import type { SessionSummary } from "./types";

export interface HeroIntroProps {
  /** 复用 ChatPage 的会话列表数据。 */
  sessions: SessionSummary[];
  /** 复用 ChatPage 的 `selectSession`。 */
  onSelect: (id: string) => void;
  /** 最近会话展示上限。 */
  limit?: number;
}

/**
 * 对话页空态 hero 引导（TASK-016 / REQ-001）。
 *
 * 大标识（`24H`）+ 标题 + 「最近会话」列表；输入区由共享的 `Composer`（`variant="hero"`）承担，
 * 本组件**不**持有输入框，确保 hero/docked 为同一 `Composer` 实例、切换不丢草稿。
 */
export default function HeroIntro({ sessions, onSelect, limit = 5 }: HeroIntroProps) {
  const recent = sessions.slice(0, limit);
  return (
    <div className="chat-hero">
      <div className="chat-hero-brand" aria-hidden="true">
        <BrandMark size={30} />
        <span className="chat-hero-brand-name">24H</span>
      </div>
      <h1 className="chat-hero-title">{t("chat.hero.title")}</h1>
      <section className="chat-hero-recent" aria-label={t("chat.hero.recent")}>
        <p className="chat-hero-recent-title">{t("chat.hero.recent")}</p>
        {recent.length > 0 ? (
          <ul className="chat-hero-recent-list">
            {recent.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="chat-hero-recent-item"
                  onClick={() => onSelect(session.id)}
                >
                  {session.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t("chat.hero.empty")}</p>
        )}
      </section>
    </div>
  );
}
