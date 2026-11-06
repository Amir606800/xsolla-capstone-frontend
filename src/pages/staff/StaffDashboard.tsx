import { useMemo } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { ComingUpCard } from '../../components/staff/ComingUpCard'
import { DeadlinesCard, GapsTile, NeedsAttentionCard, NextDeadlineTile, ThisWeekTile } from '../../components/staff/lecturer/LecturerCards'
import { MyTeamCard, OneOnOnesTile } from '../../components/staff/mentor/MentorCards'
import { useAuth } from '../../hooks/useAuth'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useCourses } from '../../hooks/useCourses'
import { useMeetingSlots } from '../../hooks/useMeetingSlots'
import { useMyTeam } from '../../hooks/useMyTeam'
import { contentGaps, focusModule, modulePhase, nextDueTasks } from '../../utils/content'
import { canAuthor, canMentor, roleLabel } from '../../utils/roles'
import { slotEvents } from '../../utils/slots'
import '../../styles/ui.css'
import '../../components/dashboard/dashboard.css'
import '../../components/staff/staff.css'
import '../lecturer/lecturer.css'

const MAX_ROWS = 5

interface Shortcut {
  to: string
  icon: IconName
  label: string
}

/**
 * One dashboard for every staff member. Its parts come from the roles:
 * - lecturer: This week / Next deadline / Needs attention tiles, Teaching shortcuts, deadlines (and missing content)
 * - mentor:   1:1s tile, Mentoring shortcut, My team card, booked 1:1s in Coming up
 * - everyone: Coming up
 * Layout: summary tiles, shortcuts, then two columns whose cards stack (the wide one is the
 * lecturer's work, the narrow one the team and the calendar).
 */
export default function StaffDashboard() {
  const { user } = useAuth()
  const author = canAuthor(user)
  const mentor = canMentor(user)
  const { status, modules, now, reload } = useCourses()
  const calendar = useCalendarEvents()
  const meetings = useMeetingSlots()
  const myTeam = useMyTeam()

  const focus = useMemo(() => focusModule(modules, now), [modules, now])
  const gaps = useMemo(() => contentGaps(modules, now), [modules, now])
  const due = useMemo(() => nextDueTasks(modules, now, MAX_ROWS), [modules, now])
  const comingUp = useMemo(() => {
    // a mentor's own booked 1:1s are part of their week
    const booked =
      user && mentor ? slotEvents(meetings.slots, { id: user.id, isMentor: true }, now).filter((e) => e.kind === 'meeting') : []
    return [...calendar.events, ...booked]
      .filter((e) => new Date(e.endsAt) > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, MAX_ROWS)
  }, [calendar.events, meetings.slots, user, mentor, now])

  const editor = focus ? `/courses/${focus.id}` : '/courses'
  const teaching: Shortcut[] = [
    { to: `${editor}?add=task`, icon: 'tasks', label: 'New task' },
    { to: `${editor}?add=material`, icon: 'file', label: 'Add material' },
    { to: `${editor}?add=quiz`, icon: 'sparkle', label: 'New quiz' },
    { to: '/calendar', icon: 'calendar', label: 'Schedule a lecture' },
  ]
  const mentoring: Shortcut[] = [{ to: '/calendar', icon: 'clock', label: 'Set 1:1 times' }]
  const team = mentor && myTeam.status === 'ready' ? myTeam.team : null

  const subtitle = author && mentor ? 'Your course and your team at a glance' : author ? 'Your course at a glance' : 'Your team at a glance'

  const group = (label: string, items: Shortcut[]) => (
    <div className="staff__action-group" role="group" aria-label={label}>
      <p className="staff__action-label" aria-hidden="true">
        {label}
      </p>
      <div className="staff__action-items">
        {items.map((s) => (
          <Link key={s.label} to={s.to} className="lect__shortcut">
            <Icon name={s.icon} size={18} />
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  )

  return (
    <section className="staff">
      <div className="staff__head">
        <div>
          <h1 className="page-title">Welcome, {user?.name}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <span className="staff__badge">{roleLabel(user)}</span>
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
          <div className="staff__stats">
            {author && focus && <ThisWeekTile module={focus} running={modulePhase(focus, now) === 'running'} />}
            {author && <NextDeadlineTile next={due[0]} now={now} />}
            {author && <GapsTile count={gaps.length} />}
            {team && <OneOnOnesTile team={team} slots={meetings.slots} now={now} />}
          </div>

          <nav className="staff__actions" aria-label="Quick actions">
            {author && group('Teaching', teaching)}
            {mentor && group('Mentoring', mentoring)}
          </nav>

          <div className="staff__cols">
            <div className="staff__col">
              {author && <DeadlinesCard due={due} now={now} />}
              {author && gaps.length > 0 && <NeedsAttentionCard gaps={gaps} />}
              {/* a mentor without the lecturer role: the team takes the wide column */}
              {!author && team && <MyTeamCard team={team} slots={meetings.slots} now={now} />}
            </div>
            <div className="staff__col">
              {author && team && <MyTeamCard team={team} slots={meetings.slots} now={now} />}
              <ComingUpCard events={comingUp} failed={calendar.status === 'error'} />
            </div>
          </div>
        </>
      )}
    </section>
  )
}
