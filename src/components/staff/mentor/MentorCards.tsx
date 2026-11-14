import { Link } from 'react-router'
import type { MeetingSlot } from '../../../types/slots'
import type { Team } from '../../../types/team'
import { formatDateTime } from '../../../utils/date'
import type { GradeDue } from '../../../utils/review'
import { myNextBooking } from '../../../utils/slots'
import { Avatar } from '../../team/People'
import { StaffCard } from '../StaffCard'
import { StatTile } from '../StatTile'

/**
 * MENTOR parts of the staff dashboard: they are about the one team the mentor looks after, so
 * only people with the mentor role see them (a lecturer who is no mentor has no team).
 */

const upcomingFree = (slots: MeetingSlot[], now: Date) => slots.filter((s) => !s.booked && new Date(s.startsAt) > now).length

/** Tile: how many of the team have a 1:1 coming up. */
export function OneOnOnesTile({ team, slots, now }: { team: Team; slots: MeetingSlot[]; now: Date }) {
  const withMeeting = team.members.filter((m) => myNextBooking(slots, m.id, now)).length
  const free = upcomingFree(slots, now)
  return (
    <StatTile
      id="mentor-1on1-tile"
      label="Team 1:1 meetings"
      value={`${withMeeting} of ${team.members.length}`}
      sub={free === 0 ? 'No open times left' : `${free} open ${free === 1 ? 'time' : 'times'} left`}
      to="/team"
    />
  )
}

/** The team at a glance: each student and their next booked 1:1. */
export function MyTeamCard({ team, slots, now }: { team: Team; slots: MeetingSlot[]; now: Date }) {
  const free = upcomingFree(slots, now)
  return (
    <StaffCard
      id="mentor-team"
      icon="team"
      title={`My team · ${team.name}`}
      action={
        <Link to="/team" className="btn btn--ghost btn--small card__action">
          Open
        </Link>
      }
    >
      <ul className="list" aria-label="Team members">
        {team.members.map((m) => {
          const next = myNextBooking(slots, m.id, now)
          return (
            <li key={m.id} className="person-row">
              <Avatar name={m.name} url={m.avatarUrl} small />
              <span className="person-row__main">
                <span className="person-row__name">{m.name}</span>
              </span>
              {next ? (
                <span className="chip chip--meeting" title="Next 1:1">
                  {formatDateTime(next.startsAt)}
                </span>
              ) : (
                <span className="chip">No 1:1</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="card__foot">
        {free === 0 ? (
          <>
            No open 1:1 times. <Link to="/calendar">Add some in the calendar</Link>
          </>
        ) : (
          <>
            {free} open 1:1 {free === 1 ? 'time' : 'times'} left. <Link to="/calendar">Add more</Link>
          </>
        )}
      </p>
    </StaffCard>
  )
}

const MAX_DUE = 6

/** Tile: week grades the mentor still owes for finished weeks. */
export function WeekGradesTile({ due }: { due: GradeDue[] }) {
  const oldest = due[0]?.module
  const inOldest = oldest ? due.filter((d) => d.module.id === oldest.id).length : 0
  return (
    <StatTile
      id="mentor-grades-tile"
      label="Week grades"
      value={due.length === 0 ? 'All given' : `${due.length} to give`}
      tone={due.length === 0 ? 'ok' : 'warn'}
      sub={
        oldest
          ? `Week ${oldest.position}: ${inOldest} ${inOldest === 1 ? 'student' : 'students'}`
          : 'Every finished week is graded'
      }
      to={oldest ? `/grading?week=${oldest.id}` : '/grading'}
    />
  )
}

/** Tile: work handed in that the mentor has not looked at / commented on yet. */
export function NewWorkTile({ count }: { count: number }) {
  return (
    <StatTile
      id="mentor-new-work"
      label="New work"
      value={count === 0 ? 'None' : `${count} hand-in${count === 1 ? '' : 's'}`}
      sub={count === 0 ? 'Everything has a comment' : 'Without a comment yet'}
      to="/grading"
    />
  )
}

/** Card: who still needs a grade for a finished week; each row opens that grade on the grading page. */
export function GradesDueCard({ due }: { due: GradeDue[] }) {
  return (
    <StaffCard
      id="mentor-grades-due"
      icon="grades"
      title="Week grades to give"
      action={
        <Link to="/grading" className="btn btn--ghost btn--small card__action">
          Grading
        </Link>
      }
    >
      {due.length === 0 ? (
        <p className="card__empty">All finished weeks are graded.</p>
      ) : (
        <>
          <ul className="list" aria-label="Week grades to give">
            {due.slice(0, MAX_DUE).map((d) => (
              <li key={`${d.module.id}-${d.student.id}`} className="person-row">
                <Avatar name={d.student.name} url={d.student.avatarUrl} small />
                <Link className="lect__row-link" to={`/grading?week=${d.module.id}&grade=${d.student.id}`}>
                  <span className="list__title">{d.student.name}</span>
                  <span className="list__meta">
                    Week {d.module.position} · {d.module.title}
                  </span>
                </Link>
                <span className="chip">Not graded</span>
              </li>
            ))}
          </ul>
          {due.length > MAX_DUE && (
            <p className="card__foot">
              <Link to="/grading">{due.length - MAX_DUE} more on the grading page</Link>
            </p>
          )}
        </>
      )}
    </StaffCard>
  )
}
