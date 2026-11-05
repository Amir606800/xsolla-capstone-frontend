import type { CalendarEvent } from '../types/calendar'
import { type AvailabilityWindow, type MeetingSlot, SLOT_MINUTES } from '../types/slots'
import { dateKey, formatClock } from './calendar'

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "15:30" -> 930 (minutes after midnight), or null when it is not a valid HH:MM. */
export function toMinutes(time: string): number | null {
  const m = TIME_RE.exec(time)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function atLocal(date: string, minutes: number): Date {
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(y, mo - 1, d, 0, minutes)
}

export interface SlotTime {
  startsAt: string
  endsAt: string
}

/**
 * Cuts a window into back-to-back slots of 30 minutes: 15:00-18:00 gives 15:00-15:30, 15:30-16:00 ...
 * 17:30-18:00. A leftover shorter than a full slot (15:00-15:45) is dropped. Invalid input gives [].
 */
export function splitWindow({ date, start, end }: AvailabilityWindow): SlotTime[] {
  const from = toMinutes(start)
  const to = toMinutes(end)
  if (from === null || to === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
  const out: SlotTime[] = []
  for (let t = from; t + SLOT_MINUTES <= to; t += SLOT_MINUTES) {
    out.push({
      startsAt: atLocal(date, t).toISOString(),
      endsAt: atLocal(date, t + SLOT_MINUTES).toISOString(),
    })
  }
  return out
}

/** The slots of a window that can still be offered: the ones that already started are skipped. */
export function upcomingSlotTimes(window: AvailabilityWindow, now: Date): SlotTime[] {
  return splitWindow(window).filter((s) => new Date(s.startsAt) > now)
}

/** A message for the mentor when the window cannot be turned into slots, else null. */
export function windowError(window: AvailabilityWindow, now: Date): string | null {
  const from = toMinutes(window.start)
  const to = toMinutes(window.end)
  if (from === null || to === null) return 'Pick a start and an end time.'
  if (to <= from) return 'The end time must be after the start time.'
  if (to - from < SLOT_MINUTES) return `The window must be at least ${SLOT_MINUTES} minutes long.`
  if (upcomingSlotTimes(window, now).length === 0) return 'That time has already passed. Pick a time in the future.'
  return null
}

/** True when two time ranges share any time (touching ends, like 15:30 and 15:30, do not overlap). */
export function overlaps(a: SlotTime, b: SlotTime): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

/** Drops the candidates that clash with an existing slot, or with each other. */
export function withoutClashes<T extends SlotTime>(candidates: T[], existing: SlotTime[]): T[] {
  const taken: SlotTime[] = [...existing]
  const out: T[] = []
  for (const c of candidates) {
    if (taken.some((t) => overlaps(c, t))) continue
    taken.push(c)
    out.push(c)
  }
  return out
}

/** "15:00 - 15:30" */
export function slotLabel(s: SlotTime): string {
  return `${formatClock(s.startsAt)} - ${formatClock(s.endsAt)}`
}

export function sortSlots<T extends SlotTime>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** The slots that start on a local day, in time order. */
export function slotsOnDay(slots: MeetingSlot[], key: string): MeetingSlot[] {
  return sortSlots(slots.filter((s) => dateKey(new Date(s.startsAt)) === key))
}

/** The student's next booked 1:1 that has not started yet. */
export function myNextBooking(slots: MeetingSlot[], userId: number, now: Date): MeetingSlot | undefined {
  return sortSlots(slots).find((s) => s.bookedBy?.id === userId && new Date(s.startsAt) > now)
}

/** Preview line for the form: "6 times: 15:00 - 15:30 ... 17:30 - 18:00". */
export function previewText(times: SlotTime[]): string {
  if (times.length === 0) return ''
  const noun = times.length === 1 ? 'time' : 'times'
  if (times.length <= 3) return `${times.length} ${noun}: ${times.map(slotLabel).join(', ')}`
  return `${times.length} ${noun}: ${slotLabel(times[0])} ... ${slotLabel(times[times.length - 1])}`
}

interface Viewer {
  id: number
  isStaff: boolean
}

/**
 * Turns slots into calendar events.
 * - Students: one "N free 1:1 times" entry per day with open slots, and their own booking as a meeting.
 * - Mentors: one summary entry per day, and every booked slot as a meeting with the student's name.
 */
export function slotEvents(slots: MeetingSlot[], viewer: Viewer, now: Date): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const days = new Map<string, MeetingSlot[]>()

  for (const s of sortSlots(slots)) {
    const future = new Date(s.startsAt) > now
    if (viewer.isStaff) {
      const list = days.get(dateKey(new Date(s.startsAt))) ?? []
      list.push(s)
      days.set(dateKey(new Date(s.startsAt)), list)
      if (s.booked && s.bookedBy) {
        events.push({
          id: `slot-${s.id}`,
          title: `1:1 with ${s.bookedBy.name}`,
          kind: 'meeting',
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          description: 'A student booked this time.',
        })
      }
    } else if (s.bookedBy?.id === viewer.id) {
      events.push({
        id: `slot-${s.id}`,
        title: `1:1 with ${s.mentorName}`,
        kind: 'meeting',
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        description: 'The time you booked with your mentor.',
      })
    } else if (!s.booked && future) {
      const list = days.get(dateKey(new Date(s.startsAt))) ?? []
      list.push(s)
      days.set(dateKey(new Date(s.startsAt)), list)
    }
  }

  for (const [key, list] of days) {
    const free = list.filter((s) => !s.booked).length
    const title = viewer.isStaff
      ? `1:1 times: ${free} of ${list.length} free`
      : `${free} free 1:1 ${free === 1 ? 'time' : 'times'}`
    events.push({
      id: `slots-${key}`,
      title,
      kind: 'availability',
      startsAt: list[0].startsAt,
      endsAt: list[list.length - 1].endsAt,
    })
  }
  return events
}
