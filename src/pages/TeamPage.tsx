import { useMemo } from 'react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useCourses } from '../hooks/useCourses'
import { useMeetingSlots } from '../hooks/useMeetingSlots'
import { useMyTeam } from '../hooks/useMyTeam'
import type { Person } from '../types/team'
import { formatDateTime } from '../utils/date'
import { initials } from '../utils/people'
import { myNextBooking } from '../utils/slots'
import '../styles/ui.css'
import '../components/module/module.css'
import './TeamPage.css'

function Avatar({ name, mentor = false }: { name: string; mentor?: boolean }) {
  return (
    <span className={`avatar${mentor ? ' avatar--mentor' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

function Contact({ person }: { person: Person }) {
  return (
    <a className="team__mail" href={`mailto:${person.email}`}>
      <Icon name="mail" size={14} />
      {person.email}
    </a>
  )
}

/**
 * "My team": the student's own team (4-5 students from a cohort of about 30) and the one mentor
 * who looks after it.
 */
export default function TeamPage() {
  const { user } = useAuth()
  const { status, team, reload } = useMyTeam()
  const { now } = useCourses()
  const meetings = useMeetingSlots()

  // the student's next booked 1:1; if the times can't be loaded the card simply leaves this line out
  const nextMeeting = useMemo(
    () => (user ? myNextBooking(meetings.slots, user.id, now) : undefined),
    [meetings.slots, user, now],
  )
  const canBook = useMemo(
    () => meetings.slots.some((s) => !s.booked && new Date(s.startsAt) > now),
    [meetings.slots, now],
  )

  return (
    <section className="module">
      <div>
        <h1 className="page-title">My team</h1>
        <p className="page-subtitle">The people you work with, and your mentor</p>
      </div>

      {status === 'loading' && (
        <p className="module__state" role="status">
          Loading your team…
        </p>
      )}

      {status === 'error' && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load your team.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && team && (
        <>
          <div className="team__grid">
            <section className="card" aria-labelledby="team-members-title">
              <header className="card__head">
                <span className="card__icon card__icon--accent">
                  <Icon name="team" size={20} />
                </span>
                <h2 id="team-members-title">{team.name}</h2>
                <span className="pill">{team.members.length} students</span>
              </header>
              <ul className="list" aria-label="Team members">
                {team.members.map((m) => (
                  <li key={m.id} className="list__row team__person">
                    <Avatar name={m.name} />
                    <div className="team__info">
                      <p className="list__title">
                        {m.name}
                        {m.id === user?.id && <span className="team__you">You</span>}
                      </p>
                      <Contact person={m} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" aria-labelledby="team-mentor-title">
              <header className="card__head">
                <span className="card__icon">
                  <Icon name="user" size={20} />
                </span>
                <h2 id="team-mentor-title">Your mentor</h2>
              </header>
              <div className="team__mentor">
                <Avatar name={team.mentor.name} mentor />
                <div className="team__info">
                  <p className="list__title">{team.mentor.name}</p>
                  <p className="list__meta">Mentor of {team.name}</p>
                  <Contact person={team.mentor} />
                </div>
              </div>
              {nextMeeting ? (
                <p className="team__meeting">
                  <Icon name="calendar" size={16} />
                  <span>
                    Next 1:1: <strong>{formatDateTime(nextMeeting.startsAt)}</strong>
                  </span>
                </p>
              ) : (
                meetings.status === 'ready' &&
                canBook && (
                  <p className="team__meeting">
                    <Icon name="calendar" size={16} />
                    <span>
                      No 1:1 booked yet. <Link to="/calendar">Pick a time in the calendar</Link>
                    </span>
                  </p>
                )
              )}
            </section>
          </div>

          <p className="team__note">
            Your cohort has {team.cohortSize} students in {team.teamCount} teams of 4-5, each with one mentor.
          </p>
        </>
      )}
    </section>
  )
}
