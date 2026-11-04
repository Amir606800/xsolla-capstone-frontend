import { memo } from 'react'
import { formatShortDate, formatTimeLeft } from '../../utils/date'
import type { DeadlineEntry } from '../../utils/progress'
import { Icon } from '../Icon'

function DeadlinesCardBase({ entries, now }: { entries: DeadlineEntry[]; now: Date }) {
  return (
    <section className="card">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="clock" size={20} />
        </span>
        <h2>Upcoming deadlines</h2>
      </header>

      {entries.length === 0 ? (
        <p className="card__empty">Nothing due. You&apos;re all caught up.</p>
      ) : (
        <ul className="list">
          {entries.map(({ item, moduleTitle, overdue }) => (
            <li key={item.id} className="list__row">
              <div>
                <p className="list__title">{item.title}</p>
                <p className="list__meta">
                  {moduleTitle} · {formatShortDate(item.dueAt)}
                </p>
              </div>
              <span className={`pill${overdue ? ' pill--danger' : ''}`}>
                {formatTimeLeft(item.dueAt, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const DeadlinesCard = memo(DeadlinesCardBase)
