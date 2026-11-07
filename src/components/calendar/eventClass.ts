import type { CalendarEvent } from '../../types/calendar'

/** True once the event is over (deadlines have their own done / overdue look instead). */
export const isPastEvent = (e: CalendarEvent, now: Date): boolean => e.kind !== 'deadline' && new Date(e.endsAt) < now

/** CSS classes for an event marker: its kind, done / overdue for deadlines, and is-past once it is over. */
export function eventClass(e: CalendarEvent, now: Date): string {
  let cls = `ev ev--${e.kind}`
  if (e.kind === 'deadline') {
    if (e.done) cls += ' is-done'
    else if (new Date(e.startsAt) < now) cls += ' is-overdue'
  } else if (isPastEvent(e, now)) cls += ' is-past'
  return cls
}
