import { memo } from 'react'
import type { CalendarEvent } from '../../types/calendar'
import { dateKey, formatClock, fullDateLabel } from '../../utils/calendar'
import { eventClass } from './eventClass'

const MAX_CHIPS = 3
const MAX_DOTS = 4
const NO_EVENTS: CalendarEvent[] = []

interface DayCellProps {
  date: Date
  inMonth: boolean
  isToday: boolean
  selected: boolean
  /** Inside a picked range of days (admin calendar). */
  inRange?: boolean
  events?: CalendarEvent[]
  now: Date
  /** `extend`: Shift was held, to stretch a range up to this day. */
  onSelect: (key: string, extend: boolean) => void
}

function DayCellBase({ date, inMonth, isToday, selected, inRange = false, events = NO_EVENTS, now, onSelect }: DayCellProps) {
  const key = dateKey(date)
  const shown = events.slice(0, MAX_CHIPS)
  const more = events.length - shown.length

  const label =
    fullDateLabel(date) + (events.length ? `, ${events.length} event${events.length === 1 ? '' : 's'}` : '')

  return (
    <button
      type="button"
      className={`cell${inMonth ? '' : ' is-outside'}${isToday ? ' is-today' : ''}${selected ? ' is-selected' : ''}${inRange ? ' is-in-range' : ''}`}
      aria-label={label}
      aria-pressed={selected}
      aria-current={isToday ? 'date' : undefined}
      onClick={(e) => onSelect(key, e.shiftKey)}
    >
      <span className="cell__num">{date.getDate()}</span>

      {/* wide screens: readable chips */}
      <span className="cell__events" aria-hidden="true">
        {shown.map((e) => (
          <span key={e.id} className={eventClass(e, now)} title={e.title}>
            {!e.allDay && <span className="ev__time">{formatClock(e.startsAt)}</span>}
            <span className="ev__title">{e.title}</span>
          </span>
        ))}
        {more > 0 && <span className="cell__more">+{more} more</span>}
      </span>

      {/* narrow screens: just coloured dots, details are in the day panel */}
      {events.length > 0 && (
        <span className="cell__dots" aria-hidden="true">
          {events.slice(0, MAX_DOTS).map((e) => (
            <span key={e.id} className={`dot ${eventClass(e, now)}`} />
          ))}
        </span>
      )}
    </button>
  )
}

export const DayCell = memo(DayCellBase)
