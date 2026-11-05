import { Children, memo, type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import type { CalendarEvent, EventKind } from '../../types/calendar'
import { formatDuration, formatEventTime, fullDateLabel } from '../../utils/calendar'
import { formatTimeLeft } from '../../utils/date'
import { Icon } from '../Icon'
import { Modal } from '../Modal'
import '../authoring/authoring.css'
import { eventClass } from './eventClass'

const KIND_LABEL: Record<EventKind, string> = {
  lecture: 'Lecture',
  meeting: 'Meeting',
  'off-campus': 'Off-campus',
  deadline: 'Deadline',
  availability: '1:1 times',
}

interface DayModalProps {
  /** The day to show, or null when the pop-up is closed. */
  date: Date | null
  events: CalendarEvent[]
  now: Date
  onClose: () => void
  /** Extra content under the events, e.g. the 1:1 slots. */
  children?: ReactNode
  /** Lecturers: which events can be changed, and how. */
  editing?: EventEditing
}

export interface EventEditing {
  canEdit: (e: CalendarEvent) => boolean
  onEdit: (e: CalendarEvent) => void
  onDelete: (e: CalendarEvent) => Promise<void>
}

function deadlineStatus(e: CalendarEvent, now: Date): string {
  if (e.done) return 'Submitted'
  return new Date(e.startsAt) < now ? 'Overdue' : `Due ${formatTimeLeft(e.startsAt, now)}`
}

function EventTools({ event, editing }: { event: CalendarEvent; editing: EventEditing }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  if (confirming) {
    return (
      <div className="event-card__tools" role="group" aria-label={`Delete ${event.title}?`}>
        <span>Delete this event for everyone?</span>
        <button
          type="button"
          className="btn btn--danger btn--small"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(undefined)
            try {
              await editing.onDelete(event)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete')
              setBusy(false)
            }
          }}
        >
          Yes, delete
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(false)} disabled={busy}>
          Keep
        </button>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
  return (
    <div className="event-card__tools">
      <button type="button" className="btn btn--ghost btn--small" onClick={() => editing.onEdit(event)} aria-label={`Edit ${event.title}`}>
        <Icon name="edit" size={16} /> Edit
      </button>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(true)} aria-label={`Delete ${event.title}`}>
        <Icon name="trash" size={16} /> Delete
      </button>
    </div>
  )
}

function EventDetails({ event, now, editing }: { event: CalendarEvent; now: Date; editing?: EventEditing }) {
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
        {editing?.canEdit(event) && <EventTools event={event} editing={editing} />}
      </div>
    </li>
  )
}

function DayModalBase({ date, events, now, onClose, children, editing }: DayModalProps) {
  // open 1:1 times are handled by the slots panel (children), not by a card of their own
  const cards = events.filter((e) => e.kind !== 'availability')
  // `false` / null children (a panel that is not shown) do not count as content
  const hasExtra = Children.toArray(children).length > 0
  return (
    <Modal open={date !== null} onClose={onClose} title={date ? fullDateLabel(date) : ''}>
      {cards.length > 0 ? (
        <ul className="event-cards" aria-label="Events">
          {cards.map((e) => (
            <EventDetails key={e.id} event={e} now={now} editing={editing} />
          ))}
        </ul>
      ) : (
        !hasExtra && <p className="card__empty">No events on this day.</p>
      )}
      {children}
    </Modal>
  )
}

export const DayModal = memo(DayModalBase)
