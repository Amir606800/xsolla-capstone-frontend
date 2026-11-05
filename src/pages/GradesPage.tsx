import { useMemo } from 'react'
import { Link } from 'react-router'
import { GradedPill } from '../components/GradedPill'
import { StandingBadge } from '../components/StandingBadge'
import { StandingBar } from '../components/StandingBar'
import { StandingPill } from '../components/StandingPill'
import { WeekTiles } from '../components/WeekTiles'
import { useCourses } from '../hooks/useCourses'
import { useModuleAccess } from '../hooks/useModuleAccess'
import { useStandings } from '../hooks/useStandings'
import { formatShortDate } from '../utils/date'
import { recentGrades } from '../utils/progress'
import {
  RED_LIMIT,
  STANDING_LABEL,
  STANDING_LEVELS,
  STANDING_MEANING,
  YELLOW_LIMIT,
  standingAlert,
} from '../utils/standing'
import { collectTasks } from '../utils/tasks'
import '../styles/ui.css'
import '../components/module/module.css'
import './GradesPage.css'

/**
 * "My grades". Every week the mentor rates the student: green (on track), yellow (falling behind)
 * or red (no progress). Four yellow weeks in a row count as red; two red weeks in a row mean removal.
 * Tasks themselves get feedback from the lecturer, listed at the bottom.
 */
export default function GradesPage() {
  const courses = useCourses()
  const standings = useStandings()
  const isLocked = useModuleAccess()
  const { modules, now } = courses
  const { summary } = standings

  const open = useMemo(() => modules.filter((m) => !isLocked(m)), [modules, isLocked])
  const titleOfWeek = useMemo(() => new Map(modules.map((m) => [m.position, m.title])), [modules])
  const graded = useMemo(() => recentGrades(open, Number.MAX_SAFE_INTEGER), [open])
  const waiting = useMemo(() => collectTasks(open, now).filter((t) => t.status === 'submitted').length, [open, now])
  const newestFirst = useMemo(() => [...summary.weeks].reverse(), [summary.weeks])
  const alert = standingAlert(summary)

  const status =
    courses.status === 'error' || standings.status === 'error'
      ? 'error'
      : courses.status === 'loading' || standings.status === 'loading'
        ? 'loading'
        : 'ready'

  function retry() {
    if (courses.status === 'error') courses.reload()
    if (standings.status === 'error') standings.reload()
  }

  return (
    <section className="module">
      <div>
        <h1 className="page-title">My grades</h1>
        <p className="page-subtitle">Your mentor rates your progress every week</p>
      </div>

      {status === 'loading' && (
        <p className="module__state" role="status">
          Loading your grades…
        </p>
      )}

      {status === 'error' && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load your grades.</p>
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <section className="card grades__summary" aria-label="Current standing">
            <StandingBadge standing={summary.current} />
            <div className="grades__summary-text">
              <h2>Where I stand</h2>
              <p className="grades__meaning">
                {summary.current
                  ? STANDING_MEANING[summary.current]
                  : 'Your mentor shares your standing at the end of every week. Nothing has been rated yet.'}
              </p>
              {alert && (
                <p className={`standing-alert standing-alert--${alert.tone}`} role="alert">
                  {alert.text}
                </p>
              )}
              <StandingBar counts={summary.counts} />
            </div>
          </section>

          <section className="card" aria-labelledby="weeks-title">
            <header className="card__head">
              <h2 id="weeks-title">Week by week</h2>
            </header>
            <div className="grades__tiles">
              <WeekTiles totalWeeks={modules.length} weeks={summary.weeks} />
            </div>
            {newestFirst.length === 0 ? (
              <p className="card__empty">No week has been rated yet.</p>
            ) : (
              <ul className="list" aria-label="Weekly ratings">
                {newestFirst.map((w) => (
                  <li key={w.week} className="list__row">
                    <div className="grades__text">
                      <p className="list__title">
                        Week {w.week}
                        {titleOfWeek.get(w.week) ? ` · ${titleOfWeek.get(w.week)}` : ''}
                      </p>
                      <p className="list__meta">Rated {formatShortDate(w.assessedAt)}</p>
                      {w.escalated && (
                        <p className="grades__escalated">
                          {YELLOW_LIMIT} yellow weeks in a row, so this week counts as red.
                        </p>
                      )}
                      {w.note && <p className="list__feedback">&ldquo;{w.note}&rdquo;</p>}
                    </div>
                    <StandingPill level={w.effective} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="feedback-title">
            <header className="card__head">
              <h2 id="feedback-title">Feedback on tasks</h2>
              {waiting > 0 && (
                <Link className="grades__waiting" to="/tasks?status=submitted">
                  {waiting} waiting to be graded
                </Link>
              )}
            </header>
            {graded.length === 0 ? (
              <p className="card__empty">No task has been graded yet.</p>
            ) : (
              <ul className="list" aria-label="Graded tasks">
                {graded.map(({ item, moduleTitle, feedback, gradedAt }) => (
                  <li key={item.id} className="list__row">
                    <div className="grades__text">
                      <Link to={`/courses/${item.moduleId}`} className="list__title grades__link">
                        {item.title}
                      </Link>
                      <p className="list__meta">
                        {moduleTitle} · graded {formatShortDate(gradedAt)}
                      </p>
                      {feedback && <p className="list__feedback">&ldquo;{feedback}&rdquo;</p>}
                    </div>
                    <GradedPill />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="rules-title">
            <header className="card__head">
              <h2 id="rules-title">How it works</h2>
            </header>
            <div className="grades__rules">
              <ul className="grades__levels">
                {STANDING_LEVELS.map((l) => (
                  <li key={l}>
                    <StandingPill level={l} />
                    <span>{STANDING_MEANING[l]}</span>
                  </li>
                ))}
              </ul>
              <ul className="grades__rule-list">
                <li>
                  {YELLOW_LIMIT} {STANDING_LABEL.yellow.toLowerCase()} weeks (yellow) in a row count as red.
                </li>
                <li>{RED_LIMIT} red weeks in a row mean removal from the program.</li>
                <li>
                  Report your progress on time, be transparent and visible to your mentor, and avoid piling up overdue
                  work.
                </li>
              </ul>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
