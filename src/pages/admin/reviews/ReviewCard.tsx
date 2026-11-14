import { REVIEW_STATEMENTS } from '../../../types/mentorReview'
import type { AdminReview } from '../../../types/mentorReview'
import { formatShortDate } from '../../../utils/date'
import { NO_SESSION_LABEL, STATEMENT_LABEL, TOPIC_LABEL } from '../../../utils/mentorReview'
import { LOW_SCORE, STATEMENT_SHORT } from '../../../utils/reviewAnalytics'

/** The overall score as text first (a colour alone would not say it): "4 / 5". */
export function ScorePill({ score }: { score: number }) {
  const tone = score <= LOW_SCORE ? ' admin-pill--hidden' : score >= 4 ? ' admin-pill--visible' : ''
  return <span className={`admin-pill${tone}`}>{score} / 5</span>
}

/** One review: who wrote it and about whom, how it went, what was said. `week` is the label of its week. */
export function ReviewCard({ review: r, week }: { review: AdminReview; week: string }) {
  const rated = REVIEW_STATEMENTS.filter((s) => r.ratings[s] !== undefined)
  return (
    <li className="admin-review">
      <header className="admin-review__head">
        <p className="admin-review__who">
          <strong>{r.studentName}</strong> about <strong>{r.mentorName}</strong>
        </p>
        <ScorePill score={r.overall} />
      </header>
      <p className="admin-muted">
        {week}
        {r.teamName ? ` · ${r.teamName}` : ''} · {formatShortDate(r.submittedAt)}
      </p>

      <p className="admin-review__session">
        {r.hadSession ? 'The 1:1 session took place.' : `No session${r.noSessionReason ? `: ${NO_SESSION_LABEL[r.noSessionReason]}` : ''}.`}
      </p>

      {r.topics.length > 0 && (
        <ul className="admin-review__topics" aria-label="Topics">
          {r.topics.map((t) => (
            <li key={t} className="admin-pill">
              {t === 'other' && r.otherTopic ? `Other: ${r.otherTopic}` : TOPIC_LABEL[t]}
            </li>
          ))}
        </ul>
      )}

      {rated.length > 0 && (
        <dl className="admin-review__ratings" aria-label="Ratings">
          {rated.map((s) => (
            <div key={s} title={STATEMENT_LABEL[s]}>
              <dt>{STATEMENT_SHORT[s]}</dt>
              <dd>{r.ratings[s]} / 5</dd>
            </div>
          ))}
        </dl>
      )}

      {r.comment && <blockquote className="admin-review__comment">{r.comment}</blockquote>}
    </li>
  )
}
