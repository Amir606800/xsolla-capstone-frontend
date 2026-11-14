/** `availability` = open mentor 1:1 times; derived from the slots API, like deadlines from assignments. */
export type EventKind = 'lecture' | 'meeting' | 'off-campus' | 'deadline' | 'availability' | 'google'

/** A person on an event or a 1:1 (names only are shown). */
export interface Attendee {
  id: number
  name: string
  email: string
  avatarUrl?: string | null
}

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
  /** Set when the event was also put on its creator's Google Calendar (the id Google gave it). */
  googleEventId?: string
  /** Who is on it: the module's lecturers and everyone enrolled, or the two people of a 1:1. */
  attendees?: Attendee[]
  /** Imported, read-only, from the signed-in person's own Google Calendar. */
  source?: 'google'
  /** Google Calendar's own page for an imported event. */
  htmlLink?: string
  /** Deadlines link back to their module. */
  moduleId?: string
  /** Deadlines: the work was already submitted. */
  done?: boolean
}
