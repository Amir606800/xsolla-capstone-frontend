import { Link } from 'react-router'
import type { MeetingSlot } from '../../../types/slots'
import type { Team } from '../../../types/team'
import { formatDateTime } from '../../../utils/date'
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
              <Avatar name={m.name} small />
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
