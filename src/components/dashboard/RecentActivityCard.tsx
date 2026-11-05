import { memo } from 'react'
import { formatRelative } from '../../utils/date'
import type { ActivityEntry, ActivityKind } from '../../utils/progress'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

const ICON: Record<ActivityKind, IconName> = { submitted: 'upload', graded: 'award', opened: 'courses' }
const VERB: Record<ActivityKind, string> = { submitted: 'Submitted', graded: 'Graded', opened: 'Opened' }

function RecentActivityCardBase({ entries, now }: { entries: ActivityEntry[]; now: Date }) {
  return (
    <section className="card">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="activity" size={20} />
        </span>
        <h2>Recent activity</h2>
      </header>

      {entries.length === 0 ? (
        <p className="card__empty">Nothing yet. Your activity will show up here.</p>
      ) : (
        <ul className="list">
          {entries.map((e) => (
            <li key={e.id} className="list__row">
              <span className={`activity__icon activity__icon--${e.kind}`}>
                <Icon name={ICON[e.kind]} size={16} />
              </span>
              <div className="activity__text">
                <p className="list__title">{e.title}</p>
                <p className="list__meta">
                  {VERB[e.kind]} · {e.moduleTitle} · {formatRelative(e.at, now)}
                </p>
              </div>
              {e.kind === 'graded' && (
                <span className="pill pill--grade">
                  {e.grade}/{e.maxPoints}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const RecentActivityCard = memo(RecentActivityCardBase)
