import { Children, memo, type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import type { CalendarEvent, EventKind } from '../../types/calendar'
import { dateKey, formatDuration, formatEventTime, fullDateLabel } from '../../utils/calendar'
import { formatTimeLeft } from '../../utils/date'
import { useAuth } from '../../hooks/useAuth'
import { isStudent } from '../../utils/roles'
import { Icon } from '../Icon'
import { GoogleBadge } from './GoogleBadge'
import { JoinMeeting } from './JoinMeeting'
import '../authoring/authoring.css'
import { eventClass, isPastEvent } from './eventClass'

const KIND_LABEL: Record<EventKind, string> = {
  lecture: 'Lecture',
  meeting: 'Meeting',
  'off-campus': 'Off-campus',
  deadline: 'Deadline',
  availability: '1:1 times',
  google: 'Google',
}

/** A short message about what just happened on this day (event saved, times added, ...). */
export interface Notice {
  tone: 'ok' | 'warn' | 'error'
  text: string
}

interface DayPanelProps {
  /** The day to show. */
  date: Date
  events: CalendarEvent[]
  now: Date
  /** Part 1 extras, under the events: the 1:1 times. */
  schedule?: ReactNode
  /** The "add" buttons of this role, in the header so they are always in view (nothing for students). */
  actions?: ReactNode
  /** The form of the open tool (add or edit), right under the header. */
  form?: ReactNode
  notice?: Notice | null
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

/** Who is on the event: names only (never emails), folded away so a big module does not fill the day. */
function Attendees({ event }: { event: CalendarEvent }) {
  const list = event.attendees ?? []
  if (list.length === 0) return null
  return (
    <details className="event-card__attendees">
      <summary>Attendees ({list.length})</summary>
      <ul>
        {list.map((a) => (
          <li key={a.id}>{a.name}</li>
        ))}
      </ul>
    </details>
  )
}

function EventDetails({ event, now, editing }: { event: CalendarEvent; now: Date; editing?: EventEditing }) {
  const { user } = useAuth()
  const duration = formatDuration(event)
  const past = isPastEvent(event, now)

  return (
    <li className={`event-card${past ? ' is-past' : ''}`}>
      <span className={`event-card__bar ${eventClass(event, now)}`} aria-hidden="true" />
      <div className="event-card__main">
        <div className="event-card__top">
          <h4 className="event-card__title">{event.title}</h4>
          <span className="pill">{KIND_LABEL[event.kind]}</span>
          {past && <span className="pill event-card__past">Past</span>}
          {!isStudent(user) && <GoogleBadge event={event} />}
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

        <Attendees event={event} />

        <JoinMeeting event={event} now={now} always={!isStudent(user) || event.source === 'google'} />

        {event.htmlLink && (
          <a className="event-card__link-out" href={event.htmlLink} target="_blank" rel="noopener noreferrer">
            Open in Google Calendar <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}

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

function DayPanelBase({ date, events, now, schedule, actions, form, notice, editing }: DayPanelProps) {
  // open 1:1 times are listed by the 1:1 list (schedule), not by a card of their own
  const cards = events.filter((e) => e.kind !== 'availability')
  // `false` / null children (a list that is not shown) do not count as content
  const hasExtra = Children.toArray(schedule).length > 0
  const isToday = dateKey(date) === dateKey(now)
  return (
    <section className="day-panel" aria-label="Day details">
      <header className="day-panel__head">
        <h2 className="day-panel__title">{fullDateLabel(date)}</h2>
        {isToday && <span className="pill">Today</span>}
        {actions}
      </header>

      {notice && (
        <p className={`day-panel__notice day-panel__notice--${notice.tone}`} role={notice.tone === 'ok' ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      {form}

      <div className="day-panel__body">
        <section className="day-panel__part" aria-labelledby="day-panel-events">
          <h3 id="day-panel-events" className="day-panel__heading">
            On this day
          </h3>
          {cards.length > 0 && (
            <ul className="event-cards" aria-label="Events">
              {cards.map((e) => (
                <EventDetails key={e.id} event={e} now={now} editing={editing} />
              ))}
            </ul>
          )}
          {schedule}
          {cards.length === 0 && !hasExtra && <p className="card__empty">No events on this day.</p>}
        </section>
      </div>
    </section>
  )
}

export const DayPanel = memo(DayPanelBase)
