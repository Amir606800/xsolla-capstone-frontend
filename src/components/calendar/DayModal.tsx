import { memo } from 'react'
import { Link } from 'react-router'
import type { CalendarEvent, EventKind } from '../../types/calendar'
import { formatDuration, formatEventTime, fullDateLabel } from '../../utils/calendar'
import { formatTimeLeft } from '../../utils/date'
import { Modal } from '../Modal'
import { eventClass } from './eventClass'

const KIND_LABEL: Record<EventKind, string> = {
  lecture: 'Lecture',
  meeting: 'Meeting',
  'off-campus': 'Off-campus',
  deadline: 'Deadline',
}

interface DayModalProps {
  /** The day to show, or null when the pop-up is closed. */
  date: Date | null
  events: CalendarEvent[]
  now: Date
  onClose: () => void
}

function deadlineStatus(e: CalendarEvent, now: Date): string {
  if (e.done) return 'Submitted'
  return new Date(e.startsAt) < now ? 'Overdue' : `Due ${formatTimeLeft(e.startsAt, now)}`
}

function EventDetails({ event, now }: { event: CalendarEvent; now: Date }) {
  const duration = formatDuration(event)

  return (
    <li className="event-card">
      <span className={`event-card__bar ${eventClass(event, now)}`} aria-hidden="true" />
      <div className="event-card__main">
        <div className="event-card__top">
          <h3 className="event-card__title">{event.title}</h3>
          <span className="pill">{KIND_LABEL[event.kind]}</span>
        </div>

        <dl className="event-card__facts">
          <div>
            <dt>Time</dt>
            <dd>
              {formatEventTime(event)}
              {duration && <span className="event-card__muted"> ({duration})</span>}
            </dd>
          </div>
          {event.location && (
            <div>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {event.kind === 'deadline' && (
            <div>
              <dt>Status</dt>
              <dd
                className={
                  event.done ? 'event-card__ok' : new Date(event.startsAt) < now ? 'event-card__danger' : undefined
                }
              >
                {deadlineStatus(event, now)}
              </dd>
            </div>
          )}
        </dl>

        {event.description && <p className="event-card__desc">{event.description}</p>}

        {event.moduleId && (
          <Link className="btn btn--ghost event-card__link" to={`/courses/${event.moduleId}`}>
            Open module
          </Link>
        )}
      </div>
    </li>
  )
}

function DayModalBase({ date, events, now, onClose }: DayModalProps) {
  return (
    <Modal open={date !== null} onClose={onClose} title={date ? fullDateLabel(date) : ''}>
      {events.length === 0 ? (
        <p className="card__empty">No events on this day.</p>
      ) : (
        <ul className="event-cards" aria-label="Events">
          {events.map((e) => (
            <EventDetails key={e.id} event={e} now={now} />
          ))}
        </ul>
      )}
    </Modal>
  )
}

export const DayModal = memo(DayModalBase)
