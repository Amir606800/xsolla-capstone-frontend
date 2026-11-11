import { useMemo } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { Avatar, Contact } from '../../components/team/People'
import { useCourses } from '../../hooks/useCourses'
import { useMeetingSlots } from '../../hooks/useMeetingSlots'
import { useMyTeam } from '../../hooks/useMyTeam'
import { formatDateTime } from '../../utils/date'
import { myNextBooking } from '../../utils/slots'
import '../../styles/ui.css'
import '../../components/module/module.css'
import '../TeamPage.css'
import '../../components/staff/staff.css'
import './mentor.css'
import { Loading } from '../../components/loading/Loading'

/**
 * MENTOR: "My team" - the 4-5 students this mentor looks after, how to reach them, and the 1:1s
 * they booked. (Weekly green/yellow/red ratings will be given from here next.)
 */
export default function MentorTeamPage() {
  const { status, team, reload } = useMyTeam()
  const { now } = useCourses()
  const meetings = useMeetingSlots()

  const upcoming = useMemo(() => meetings.slots.filter((s) => new Date(s.startsAt) > now), [meetings.slots, now])
  const booked = upcoming.filter((s) => s.booked)
  const free = upcoming.length - booked.length

  return (
    <section className="module">
      <div>
        <h1 className="page-title">My team</h1>
        <p className="page-subtitle">The students you mentor</p>
      </div>

      {status === 'loading' && (
        <Loading className="module__state">Loading your team…</Loading>
      )}

      {status === 'error' && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load your team.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && !team && (
        <div className="module__state">
          <p>You do not look after a team yet. An admin gives each team its mentor.</p>
        </div>
      )}

      {status === 'ready' && team && (
        <>
          <div className="team__grid">
            <section className="card" aria-labelledby="mentor-team-title">
              <header className="card__head">
                <span className="card__icon card__icon--accent">
                  <Icon name="team" size={20} />
                </span>
                <h2 id="mentor-team-title">{team.name}</h2>
                <span className="pill">{team.members.length} students</span>
              </header>
              <ul className="list" aria-label="Students">
                {team.members.map((m) => {
                  const next = meetings.status === 'ready' ? myNextBooking(meetings.slots, m.id, now) : undefined
                  return (
                    <li key={m.id} className="list__row team__person mentor__student">
                      <Avatar name={m.name} />
                      <div className="team__info">
                        <p className="list__title">{m.name}</p>
                        <Contact person={m} />
                      </div>
                      {meetings.status === 'ready' &&
                        (next ? (
                          <span className="chip chip--meeting">
                            <span className="sr-only">Next 1:1: </span>
                            {formatDateTime(next.startsAt)}
                          </span>
                        ) : (
                          <span className="chip">No 1:1 booked</span>
                        ))}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="card" aria-labelledby="mentor-1on1-title">
              <header className="card__head">
                <span className="card__icon">
                  <Icon name="clock" size={20} />
                </span>
                <h2 id="mentor-1on1-title">1:1 times</h2>
              </header>
              {meetings.status === 'error' ? (
                <p className="card__empty">The 1:1 times could not be loaded.</p>
              ) : (
                <>
                  <dl className="stat-pair">
                    <div>
                      <dt>Booked</dt>
                      <dd>{booked.length}</dd>
                    </div>
                    <div>
                      <dt>Still open</dt>
                      <dd>{free}</dd>
                    </div>
                  </dl>
                  {booked.length > 0 && (
                    <>
                      <h3 className="card__subhead">Coming 1:1s</h3>
                      <ul className="list" aria-label="Booked 1:1s">
                        {booked.map((s) => (
                          <li key={s.id} className="person-row">
                            <Avatar name={s.bookedBy?.name ?? '?'} small />
                            <span className="person-row__main">
                              <span className="person-row__name">{s.bookedBy?.name ?? 'A student'}</span>
                            </span>
                            <span className="chip chip--meeting">{formatDateTime(s.startsAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="card__foot">
                    <Link to="/calendar">Open the calendar</Link> to add times or cancel a booking.
                  </p>
                </>
              )}
            </section>
          </div>

          <p className="team__note">
            The cohort has {team.cohortSize} students in {team.teamCount} teams of 4-5, each with one mentor.
          </p>
        </>
      )}
    </section>
  )
}
