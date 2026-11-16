import { StandingPill } from '../../../components/StandingPill'
import type { StudentReview } from '../../../types/studentReview'
import { formatDateTime } from '../../../utils/date'

/** One mentor's grade of one student for one week, with the module feedback that came with it. */
export function StudentReviewCard({ review: r, week }: { review: StudentReview; week: string }) {
  return (
    <li className="admin-review">
      <header className="admin-review__head">
        <p className="admin-review__who">
          <strong>{r.mentorName ?? 'A mentor'}</strong> about <strong>{r.studentName}</strong>
        </p>
        <StandingPill level={r.level} />
      </header>
      <p className="admin-muted">
        {week}
        {r.teamName ? ` · ${r.teamName}` : ''}
        {' · '}
        {formatDateTime(r.gradedAt)}
      </p>
      {r.note ? (
        <div>
          <p className="admin-review__label">Module feedback</p>
          <blockquote className="admin-review__comment">{r.note}</blockquote>
        </div>
      ) : (
        <p className="admin-muted">No module feedback.</p>
      )}
    </li>
  )
}
