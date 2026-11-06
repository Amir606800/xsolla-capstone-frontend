import { Link } from 'react-router'
import type { CalendarEvent } from '../../types/calendar'
import { formatEventTime } from '../../utils/calendar'
import { formatShortDate } from '../../utils/date'
import { StaffCard } from './StaffCard'

/** SHARED by every staff member: what is next on the calendar (mentors also see their booked 1:1s). */
export function ComingUpCard({ events, failed }: { events: CalendarEvent[]; failed: boolean }) {
  return (
    <StaffCard
      id="lect-calendar"
      icon="calendar"
      title="Coming up"
      action={
        <Link to="/calendar" className="btn btn--ghost btn--small card__action">
          Calendar
        </Link>
      }
    >
      {failed ? (
        <p className="card__empty">The calendar could not be loaded.</p>
      ) : events.length === 0 ? (
        <p className="card__empty">Nothing scheduled yet.</p>
      ) : (
        <ul className="list" aria-label="Coming up">
          {events.map((e) => (
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
    </StaffCard>
  )
}
