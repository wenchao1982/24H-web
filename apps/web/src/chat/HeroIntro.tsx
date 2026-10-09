import { t } from "../i18n";
import { BrandMark } from "../ui/icons";
import type { SessionSummary } from "./types";

export interface HeroIntroProps {
  /** 最近会话展示上限（保留参数兼容）。 */
  limit?: number;
}

/**
 * 对话页空态 hero 引导（TASK-016 / REQ-001）：大标识 + 标题 + 副标题。
 * 输入区由共享 `Composer`（`variant="hero"`）承担；最近会话由 `HeroRecent` 承载（置于输入框下方）。
 */
export default function HeroIntro(_props: HeroIntroProps) {
  return (
    <div className="chat-hero chat-hero-head">
      <div className="chat-hero-brand">
        <BrandMark size={30} />
        <span className="chat-hero-brand-name">{t("chat.hero.title")}</span>
        <span className="chat-hero-badge">{t("chat.hero.preview")}</span>
      </div>
      <p className="chat-hero-subtitle">{t("chat.hero.subtitle")}</p>
    </div>
  );
}

export interface HeroRecentProps {
  sessions: SessionSummary[];
  onSelect: (id: string) => void;
  limit?: number;
}

/** hero 态「最近会话」卡片网格（两列）。 */
export function HeroRecent({ sessions, onSelect, limit = 6 }: HeroRecentProps) {
  const recent = sessions.slice(0, limit);
  return (
    <section className="chat-hero-recent" aria-label={t("chat.hero.recent")}>
      <p className="chat-hero-recent-title">{t("chat.hero.recent")}</p>
      {recent.length > 0 ? (
        <ul className="chat-hero-recent-grid">
          {recent.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className="chat-hero-recent-item"
                onClick={() => onSelect(session.id)}
              >
                <span className="chat-hero-recent-name">{session.title}</span>
                {session.updatedAt ? (
                  <span className="chat-hero-recent-meta">{session.updatedAt}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("chat.hero.empty")}</p>
      )}
    </section>
  );
}
