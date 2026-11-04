import type { CalendarEvent } from '../../types/calendar'

/** CSS classes for an event marker: its kind plus, for deadlines, done / overdue state. */
export function eventClass(e: CalendarEvent, now: Date): string {
  let cls = `ev ev--${e.kind}`
  if (e.kind === 'deadline') {
    if (e.done) cls += ' is-done'
    else if (new Date(e.startsAt) < now) cls += ' is-overdue'
  }
  return cls
}
