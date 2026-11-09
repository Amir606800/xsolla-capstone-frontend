import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { KIND_LABEL } from '../../utils/adminCalendar'
import type { WeekSummary } from '../../utils/adminWeek'
import { formatClockTime, formatShortDate } from '../../utils/date'

const dayFmt = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const kindLabel = (kind: string) => KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind

const EYEBROW = { current: 'This week', next: 'Next week', last: 'Last week of the program' } as const

/**
 * Admin overview: the module (week) that is on now, in one card: who teaches it, the lectures and other
 * events with their times, the tasks and when they are due. Between weeks it shows the one that opens next.
 */
export function CurrentWeekCard({ summary, nameOf, now }: { summary: WeekSummary; nameOf: (id: number) => string; now: Date }) {
  const { module, state } = summary

  if (!module || state === 'none' || state === 'undated') {
    return (
      <section className="admin-panel admin-week" aria-label="Current week">
        <h2 className="admin-section-title">This week</h2>
        <p className="admin-muted">
          {state === 'none'
            ? 'There are no modules yet.'
            : 'The modules have no week dates yet, so the current week cannot be told. Set the dates of a week to see it here.'}{' '}
          <Link className="admin-link" to="/admin/modules">
            Go to Modules
          </Link>
        </p>
      </section>
    )
  }

  const eyebrow = EYEBROW[state]
  const range = `${formatShortDate(module.opensAt ?? '')} – ${formatShortDate(module.closesAt ?? '')}`
  const nextUp = summary.events.find((e) => e.kind === 'lecture' && new Date(e.endsAt) >= now)

  return (
    <section className="admin-panel admin-week" aria-label="Current week">
      <header className="admin-week__head">
        <div>
          <p className="admin-week__eyebrow">{eyebrow}</p>
          <h2 className="admin-section-title">
            Week {module.position} · {module.title}
          </h2>
          <p className="admin-muted">
            {range}
            {summary.day ? ` · day ${summary.day.number} of ${summary.day.of}` : ''}
          </p>
        </div>
        <Link className="admin-btn" to={`/admin/modules/${module.id}`}>
          <Icon name="courses" size={16} /> Open module
        </Link>
      </header>

      <div className="admin-week__grid">
        <div className="admin-week__block">
          <h3 className="admin-week__label">Lecturer</h3>
          {summary.lecturerId !== undefined ? (
            <p className="admin-week__who">
              <Icon name="lecturer" size={16} /> {nameOf(summary.lecturerId)}
            </p>
          ) : (
            <p className="admin-week__who">
              <span className="admin-pill admin-pill--hidden">No lecturer yet</span>{' '}
              <Link className="admin-link" to="/admin/lecturers">
                Assign one
              </Link>
            </p>
          )}
          <p className="admin-muted admin-week__counts">
            {plural(summary.tasks.length, 'task')} · {plural(summary.resources, 'resource')} · {plural(summary.quizzes, 'quiz', 'quizzes')}
          </p>
        </div>

        <div className="admin-week__block">
          <h3 className="admin-week__label">Lectures and events</h3>
          {summary.events.length === 0 ? (
            <p className="admin-muted">Nothing planned this week.</p>
          ) : (
            <ul className="admin-week__list" aria-label="Events this week">
              {summary.events.map((e) => {
                const past = new Date(e.endsAt) < now
                return (
                  <li key={e.id} className={past ? 'is-past' : undefined}>
                    <span className="admin-week__when">
                      {dayFmt.format(new Date(e.startsAt))}
                      <span className="admin-muted">
                        {e.allDay ? ' · all day' : ` · ${formatClockTime(e.startsAt)}–${formatClockTime(e.endsAt)}`}
                      </span>
                    </span>
                    <span className="admin-week__what">
                      {e.title}
                      {kindLabel(e.kind).toLowerCase() !== e.title.trim().toLowerCase() && <span className="admin-pill">{kindLabel(e.kind)}</span>}
                      {e.id === nextUp?.id && <span className="admin-pill admin-pill--role">Next lecture</span>}
                      {past && <span className="admin-muted"> · done</span>}
                    </span>
                    {e.location && <span className="admin-muted">{e.location}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="admin-week__block">
          <h3 className="admin-week__label">Tasks</h3>
          {summary.tasks.length === 0 ? (
            <p className="admin-muted">No tasks in this week.</p>
          ) : (
            <ul className="admin-week__list" aria-label="Tasks of the week">
              {summary.tasks.map((t) => {
                const over = new Date(t.dueAt) < now
                return (
                  <li key={t.id} className={over ? 'is-past' : undefined}>
                    <span className="admin-week__what">{t.title}</span>
                    <span className="admin-muted">
                      {over ? 'Was due' : 'Due'} {dayFmt.format(new Date(t.dueAt))}, {formatClockTime(t.dueAt)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
