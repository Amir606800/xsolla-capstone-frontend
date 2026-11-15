import type { AdminLectureReview } from '../../../types/lectureReview'
import { formatClockTime, formatDateTime } from '../../../utils/date'
import { LECTURE_SCORES, PACE_LABEL } from '../../../utils/lectureAnalytics'
import { ScorePill } from './ReviewCard'

/** One lecture review: who wrote it, about which lecture and whose, the scores, the pace and the two comments. */
export function LectureReviewCard({ review: r }: { review: AdminLectureReview }) {
  return (
    <li className="admin-review">
      <header className="admin-review__head">
        <p className="admin-review__who">
          <strong>{r.studentName}</strong> about <strong>{r.lecture.title}</strong>
        </p>
        <ScorePill score={r.overall} />
      </header>
      <p className="admin-muted">
        {formatDateTime(r.lecture.startsAt)}–{formatClockTime(r.lecture.endsAt)}
        {r.lecture.moduleTitle ? ` · ${r.lecture.moduleTitle}` : ''}
        {' · '}
        {r.lecturers.length > 0 ? `Lecturer: ${r.lecturers.map((l) => l.name).join(', ')}` : 'No lecturer assigned'}
      </p>

      <dl className="admin-review__ratings" aria-label="Scores">
        {LECTURE_SCORES.filter((s) => s.key !== 'overall').map((s) => (
          <div key={s.key}>
            <dt>{s.label}</dt>
            <dd>{r[s.key]} / 5</dd>
          </div>
        ))}
        <div>
          <dt>Pace</dt>
          <dd>{PACE_LABEL[r.pace]}</dd>
        </div>
      </dl>

      {r.liked && (
        <div>
          <p className="admin-review__label">What worked well</p>
          <blockquote className="admin-review__comment">{r.liked}</blockquote>
        </div>
      )}
      {r.improve && (
        <div>
          <p className="admin-review__label">What could be better</p>
          <blockquote className="admin-review__comment">{r.improve}</blockquote>
        </div>
      )}
    </li>
  )
}
