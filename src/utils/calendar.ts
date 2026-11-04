import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import { assignmentsOf } from './progress'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const GRID_DAYS = 42 // 6 weeks: the grid keeps the same height in every month

const monthFmt = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
const fullDateFmt = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false })

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day as YYYY-MM-DD (not UTC, so late-evening events stay on their day). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** 42 consecutive local days starting on the Monday on/before the 1st of `month`. */
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month)
  const offset = (first.getDay() + 6) % 7 // Monday = 0
  return Array.from(
    { length: GRID_DAYS },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + i),
  )
}

export function monthLabel(d: Date): string {
  return monthFmt.format(d)
}

export function fullDateLabel(d: Date): string {
  return fullDateFmt.format(d)
}

export function formatClock(iso: string): string {
  return timeFmt.format(new Date(iso))
}

/** "All day", "15:00" (point in time) or "15:00 - 15:30". */
export function formatEventTime(e: CalendarEvent): string {
  if (e.allDay) return 'All day'
  if (e.startsAt === e.endsAt) return formatClock(e.startsAt)
  return `${formatClock(e.startsAt)} - ${formatClock(e.endsAt)}`
}

/** "30 min", "2 h", "1 h 30 min"; empty for all-day or zero-length events. */
export function formatDuration(e: CalendarEvent): string {
  if (e.allDay) return ''
  const minutes = Math.round((new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime()) / 60_000)
  if (minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Groups events by the local day they start on; each day is sorted by time (all-day first). */
export function groupByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const out: Record<string, CalendarEvent[]> = {}
  for (const e of events) {
    ;(out[dateKey(new Date(e.startsAt))] ??= []).push(e)
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => {
      if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1
      return a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title)
    })
  }
  return out
}

/** Task deadlines appear on the calendar automatically. */
export function deadlineEvents(modules: CourseModule[]): CalendarEvent[] {
  return modules.flatMap((m) =>
    assignmentsOf(m).map(
      (a): CalendarEvent => ({
        id: `deadline-${a.id}`,
        title: `Due: ${a.title}`,
        kind: 'deadline',
        startsAt: a.dueAt,
        endsAt: a.dueAt,
        moduleId: m.id,
        done: a.submission !== undefined,
      }),
    ),
  )
}
