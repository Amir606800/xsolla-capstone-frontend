/** `availability` = open mentor 1:1 times; derived from the slots API, like deadlines from assignments. */
export type EventKind = 'lecture' | 'meeting' | 'off-campus' | 'deadline' | 'availability'

/**
 * One entry on the calendar. Events with a start and an end (lectures, mentor
 * 1:1s, off-campus days) come from the events API; task deadlines are derived
 * from assignments (see `deadlineEvents`).
 * An event is shown on the day it starts; multi-day events are not supported yet.
 */
export interface CalendarEvent {
  id: string
  title: string
  kind: EventKind
  startsAt: string // ISO
  endsAt: string // ISO
  allDay?: boolean
  /** Optional details shown in the day pop-up. */
  location?: string
  description?: string
  /** Lectures: the online meeting link (e.g. Google Meet). Students see a Join button shortly before the start. */
  meetingUrl?: string
  /** Deadlines link back to their module. */
  moduleId?: string
  /** Deadlines: the work was already submitted. */
  done?: boolean
}
