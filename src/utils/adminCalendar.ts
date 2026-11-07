import type { CalendarEvent, EventKind } from '../types/calendar'
import { dateKey } from './calendar'

/** The events the admin manages: not task deadlines and not 1:1 times. */
export const SCHOOL_KINDS = ['lecture', 'meeting', 'off-campus'] as const satisfies readonly EventKind[]
export type SchoolKind = (typeof SCHOOL_KINDS)[number]

export const KIND_LABEL: Record<SchoolKind, string> = { lecture: 'Lecture', meeting: 'Meeting', 'off-campus': 'Off-campus' }
export const KIND_PLURAL: Record<SchoolKind, string> = { lecture: 'Lectures', meeting: 'Meetings', 'off-campus': 'Off-campus' }

export const isSchoolEvent = (e: CalendarEvent): boolean => (SCHOOL_KINDS as readonly string[]).includes(e.kind)

const sameMonth = (iso: string, month: Date) => {
  const d = new Date(iso)
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
}

/** School events that start in the month (or on the day, a "yyyy-mm-dd" key), sorted by time. */
export function eventsIn(events: CalendarEvent[], month: Date, day?: string | null): CalendarEvent[] {
  return events
    .filter((e) => isSchoolEvent(e) && (day ? dateKey(new Date(e.startsAt)) === day : sameMonth(e.startsAt, month)))
    .sort(byTime)
}

const byTime = (a: CalendarEvent, b: CalendarEvent) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title)

/** A range of whole days, "yyyy-mm-dd" keys, both included. */
export interface DayRange {
  from: string
  to: string
}

/** School events that start on a day inside the range, sorted by time. */
export function eventsBetween(events: CalendarEvent[], range: DayRange): CalendarEvent[] {
  return events
    .filter((e) => {
      if (!isSchoolEvent(e)) return false
      const key = dateKey(new Date(e.startsAt))
      return key >= range.from && key <= range.to
    })
    .sort(byTime)
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** The whole month that `month` is in. */
export const monthRange = (month: Date): DayRange => ({
  from: dateKey(new Date(month.getFullYear(), month.getMonth(), 1)),
  to: dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
})

/** Monday to Sunday of the week `day` is in. */
export function weekRange(day: Date): DayRange {
  const monday = addDays(day, -((day.getDay() + 6) % 7))
  return { from: dateKey(monday), to: dateKey(addDays(monday, 6)) }
}

/** `n` days starting with `day`. */
export const nextDays = (day: Date, n: number): DayRange => ({ from: dateKey(day), to: dateKey(addDays(day, n - 1)) })

/** Puts the earlier day first. */
export const ordered = (a: string, b: string): DayRange => (a <= b ? { from: a, to: b } : { from: b, to: a })

export const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const yearFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Nov 9 – Nov 22", with years only when the range crosses one. */
export function rangeLabel(r: DayRange): string {
  const from = keyToDate(r.from)
  const to = keyToDate(r.to)
  const fmt = from.getFullYear() === to.getFullYear() ? shortFmt : yearFmt
  return `${fmt.format(from)} – ${fmt.format(to)}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A local "yyyy-mm-dd" + "hh:mm" -> ISO, or null when either is missing or invalid. */
function localIso(date: string, time: string): string | null {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return null
  const out = new Date(y, m - 1, d, h, min)
  return Number.isNaN(out.getTime()) ? null : out.toISOString()
}

/** The event moved to start on `date` at `time`, keeping how long it lasts. All-day events keep their whole day. */
export function postpone(e: CalendarEvent, date: string, time: string): CalendarEvent | null {
  const startsAt = localIso(date, e.allDay ? '00:00' : time)
  if (!startsAt) return null
  const length = new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime()
  return { ...e, startsAt, endsAt: new Date(new Date(startsAt).getTime() + length).toISOString() }
}

/** Date and time inputs ("yyyy-mm-dd", "hh:mm") for an event's start, moved by `days`. */
export function startInputs(e: CalendarEvent, days = 0): { date: string; time: string } {
  const d = new Date(e.startsAt)
  d.setDate(d.getDate() + days)
  return { date: dateKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}
