import type { SessionContentMatch } from "./sessionSearch";

export interface ContentMatchesProps {
  matches: SessionContentMatch[];
  onSelect: (id: string) => void;
}

/** 侧栏「内容匹配」：会话标题过滤之外的全文（FTS5）命中，点击选中该会话。 */
export default function ContentMatches({ matches, onSelect }: ContentMatchesProps) {
  if (matches.length === 0) {
    return null;
  }
  return (
    <section className="content-matches" aria-label="内容匹配">
      <p className="content-matches-title">内容匹配（{matches.length}）</p>
      <ul className="content-matches-list">
        {matches.map((match) => (
          <li key={match.id}>
            <button
              type="button"
              className="content-match"
              onClick={() => onSelect(match.id)}
            >
              <span className="content-match-title">{match.title}</span>
              {match.snippet ? (
                <span className="content-match-snippet">{match.snippet}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
