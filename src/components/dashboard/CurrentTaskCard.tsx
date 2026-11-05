import { memo } from 'react'
import { Link } from 'react-router'
import { useCurrentModule } from '../../hooks/useCurrentModule'
import { formatDateTime, formatTimeLeft } from '../../utils/date'
import { moduleProgress, nextAssignment, URGENT_WITHIN_MS } from '../../utils/progress'
import { Icon } from '../Icon'

/** Small overview of this week's module and the next task to hand in. */
function CurrentTaskCardBase() {
  const { current, now } = useCurrentModule()
  const progress = current ? moduleProgress(current, now) : null
  const next = current ? nextAssignment(current) : null
  const urgent = next ? new Date(next.dueAt).getTime() - now.getTime() < URGENT_WITHIN_MS : false

  return (
    <section className="card">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="tasks" size={20} />
        </span>
        <h2>Current task</h2>
      </header>

      {!current || !progress ? (
        <p className="card__empty">No module is running right now.</p>
      ) : (
        <div className="current">
          <p className="current__module">
            Module {current.position} · {current.title}
          </p>

          <div
            className="current__bar"
            role="progressbar"
            aria-label="Module task progress"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.submitted}
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="current__count">
            {progress.submitted} of {progress.total} tasks submitted
          </p>

          {next ? (
            <div className="current__next">
              <p className="current__label">Next task</p>
              <p className="list__title">{next.title}</p>
              <p className="list__meta">Due {formatDateTime(next.dueAt)}</p>
              <span className={`pill${urgent ? ' pill--danger' : ''}`}>{formatTimeLeft(next.dueAt, now)}</span>
            </div>
          ) : (
            <p className="current__done">All tasks in this module are submitted.</p>
          )}

          <Link to={`/courses/${current.id}`} className="btn btn--ghost current__open">
            Open module
          </Link>
        </div>
      )}
    </section>
  )
}

export const CurrentTaskCard = memo(CurrentTaskCardBase)
