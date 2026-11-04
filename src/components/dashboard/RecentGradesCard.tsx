import { memo } from 'react'
import { formatShortDate } from '../../utils/date'
import type { GradeEntry } from '../../utils/progress'
import { Icon } from '../Icon'

function RecentGradesCardBase({ entries }: { entries: GradeEntry[] }) {
  return (
    <section className="card">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="award" size={20} />
        </span>
        <h2>Recent grades</h2>
      </header>

      {entries.length === 0 ? (
        <p className="card__empty">No graded work yet.</p>
      ) : (
        <ul className="list">
          {entries.map(({ item, moduleTitle, grade, feedback, gradedAt }) => (
            <li key={item.id} className="list__row">
              <div>
                <p className="list__title">{item.title}</p>
                <p className="list__meta">
                  {moduleTitle} · {formatShortDate(gradedAt)}
                </p>
                {feedback && <p className="list__feedback">&ldquo;{feedback}&rdquo;</p>}
              </div>
              <span className="pill pill--grade">
                {grade}/{item.maxPoints}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const RecentGradesCard = memo(RecentGradesCardBase)
