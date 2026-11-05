import { useMemo } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { useAuth } from '../../hooks/useAuth'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useCourses } from '../../hooks/useCourses'
import { useMeetingSlots } from '../../hooks/useMeetingSlots'
import { formatEventTime } from '../../utils/calendar'
import { contentCounts, contentGaps, modulePhase, nextDueTasks } from '../../utils/content'
import { formatDateTime, formatShortDate, formatTimeLeft } from '../../utils/date'
import { slotEvents } from '../../utils/slots'
import '../../styles/ui.css'
import '../../components/dashboard/dashboard.css'
import '../../components/calendar/calendar.css'
import './lecturer.css'

const MAX_ROWS = 5

function Card({ id, icon, title, children, action }: { id: string; icon: IconName; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card" aria-labelledby={id}>
      <header className="card__head">
        <span className="card__icon">
          <Icon name={icon} size={20} />
        </span>
        <h2 id={id}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/**
 * Lecturer dashboard (first version): the module running now, what still needs content, the next
 * deadlines and what is coming up on the calendar, with shortcuts to the things students depend on.
 */
export default function LecturerDashboard() {
  const { user } = useAuth()
  const { status, modules, now, reload } = useCourses()
  const calendar = useCalendarEvents()
  const meetings = useMeetingSlots()

  const sorted = useMemo(() => [...modules].sort((a, b) => a.position - b.position), [modules])
  // the module running now, else the next one to open, else the last one
  const focus = useMemo(
    () =>
      sorted.find((m) => modulePhase(m, now) === 'running') ??
      sorted.find((m) => modulePhase(m, now) === 'upcoming') ??
      sorted[sorted.length - 1],
    [sorted, now],
  )
  const gaps = useMemo(() => contentGaps(modules, now), [modules, now])
  const due = useMemo(() => nextDueTasks(modules, now, MAX_ROWS), [modules, now])
  const comingUp = useMemo(() => {
    const booked = user ? slotEvents(meetings.slots, { id: user.id, isStaff: true }, now).filter((e) => e.kind === 'meeting') : []
    return [...calendar.events, ...booked]
      .filter((e) => new Date(e.endsAt) > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, MAX_ROWS)
  }, [calendar.events, meetings.slots, user, now])

  const editor = focus ? `/courses/${focus.id}` : '/courses'
  const shortcuts: { to: string; icon: IconName; label: string }[] = [
    { to: `${editor}?add=task`, icon: 'tasks', label: 'New task' },
    { to: `${editor}?add=material`, icon: 'file', label: 'Add material' },
    { to: `${editor}?add=quiz`, icon: 'sparkle', label: 'New quiz' },
    { to: '/calendar', icon: 'calendar', label: 'Schedule a lecture' },
    { to: '/calendar', icon: 'clock', label: 'Set 1:1 times' },
  ]

  return (
    <section className="dash lect">
      <div className="dash__top">
        <div>
          <h1 className="page-title">Welcome, {user?.name}</h1>
          <p className="page-subtitle">Your course at a glance</p>
        </div>
      </div>

      {status === 'loading' && (
        <p className="dash__state" role="status">
          Loading the course…
        </p>
      )}
      {status === 'error' && (
        <div className="dash__state" role="alert">
          <p>We couldn&apos;t load the course.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <nav className="lect__shortcuts" aria-label="Quick actions">
            {shortcuts.map((s) => (
              <Link key={s.label} to={s.to} className="lect__shortcut">
                <Icon name={s.icon} size={18} />
                {s.label}
              </Link>
            ))}
          </nav>

          <div className="lect__grid">
            {focus && (
              <Card
                id="lect-focus"
                icon="courses"
                title={modulePhase(focus, now) === 'running' ? 'This week' : 'Next module'}
                action={
                  <Link to={editor} className="btn btn--ghost btn--small card__action">
                    Open
                  </Link>
                }
              >
                <div className="lect__focus">
                  <p className="lect__focus-title">
                    Module {focus.position} · {focus.title}
                  </p>
                  {focus.opensAt && focus.closesAt && (
                    <p className="list__meta">
                      {formatShortDate(focus.opensAt)} - {formatShortDate(focus.closesAt)}
                    </p>
                  )}
                  <dl className="lect__counts">
                    {Object.entries(contentCounts(focus)).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k === 'materials' ? 'Materials' : k === 'tasks' ? 'Tasks' : 'Quizzes'}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Card>
            )}

            <Card id="lect-gaps" icon="alert" title="Needs attention">
              {gaps.length === 0 ? (
                <p className="card__empty">Everything for the coming weeks is in place.</p>
              ) : (
                <ul className="list" aria-label="Needs attention">
                  {gaps.slice(0, 6).map((g) => (
                    <li key={g.id} className="list__row">
                      <Link to={`/courses/${g.moduleId}`} className="lect__row-link">
                        <span className="list__title">Module {g.position}</span>
                        <span className="list__meta">{g.text}</span>
                      </Link>
                    </li>
                  ))}
                  {gaps.length > 6 && (
                    <li className="list__row">
                      <Link to="/courses" className="lect__more">
                        {gaps.length - 6} more in Course content
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </Card>

            <Card id="lect-due" icon="tasks" title="Upcoming deadlines">
              {due.length === 0 ? (
                <p className="card__empty">No deadlines ahead.</p>
              ) : (
                <ul className="list" aria-label="Upcoming deadlines">
                  {due.map(({ task, module }) => (
                    <li key={task.id} className="list__row">
                      <Link to={`/courses/${module.id}`} className="lect__row-link">
                        <span className="list__title">{task.title}</span>
                        <span className="list__meta">
                          Module {module.position} · {formatDateTime(task.dueAt)} ({formatTimeLeft(task.dueAt, now)})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              id="lect-calendar"
              icon="calendar"
              title="Coming up"
              action={
                <Link to="/calendar" className="btn btn--ghost btn--small card__action">
                  Calendar
                </Link>
              }
            >
              {calendar.status === 'error' ? (
                <p className="card__empty">The calendar could not be loaded.</p>
              ) : comingUp.length === 0 ? (
                <p className="card__empty">Nothing scheduled yet.</p>
              ) : (
                <ul className="list" aria-label="Coming up">
                  {comingUp.map((e) => (
                    <li key={e.id} className="list__row">
                      <span className={`lect__dot ev ev--${e.kind}`} aria-hidden="true" />
                      <span className="lect__row-text">
                        <span className="list__title">{e.title}</span>
                        <span className="list__meta">
                          {formatShortDate(e.startsAt)} · {formatEventTime(e)}
                          {e.location ? ` · ${e.location}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  )
}
