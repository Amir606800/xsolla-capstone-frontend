import type { AssignmentItem, CourseModule, DueFrom } from '../types/course'
import { formatDateTime } from './date'

/**
 * Task deadlines follow the student's weekly 1:1 (backend docs/one_on_one_deadlines.md). A task has no deadline of its
 * own any more: a student's work for a week is due by 08:00 (school time) on the day of their 1:1 with the mentor, so
 * the mentor can read it first. Mentors open 1:1 slots on Friday and Monday:
 *
 *  - 1:1 booked on the Friday of the week:      Friday 08:00
 *  - 1:1 booked on the Monday after it:         Monday 08:00
 *  - booked on another day of that weekend:     08:00 that day (several: the earliest)
 *  - no 1:1 booked yet (or it was cancelled):   Monday 08:00, so nobody is late only because they have not booked
 *
 * The week is the module's: its 1:1 weekend is the first Friday on or after the module opens, to the Tuesday after.
 * The module's closing date plays no part. Handing in stays open after the deadline; work handed in late is a
 * "Late submission" and turns the student's week grade red.
 */

/** The school is in Baku: UTC+4 all year (no daylight saving). */
const SCHOOL_OFFSET_MS = 4 * 3_600_000
/** Work is due at 08:00 school time on the day of the 1:1. */
export const DUE_HOUR = 8

/** The school-time calendar day of a moment. */
function schoolDay(at: Date) {
  const t = new Date(at.getTime() + SCHOOL_OFFSET_MS)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), weekday: t.getUTCDay() }
}

/** The moment of a school-time wall clock (days may overflow: the 32nd is the 1st of the next month). */
const schoolTime = (y: number, m: number, d: number, hour = 0) => new Date(Date.UTC(y, m, d, hour) - SCHOOL_OFFSET_MS)

export interface OneOnOneWeek {
  /** Friday 00:00, school time. */
  from: string
  /** The Tuesday after, 00:00: the end of the weekend (not included). */
  to: string
  /** Friday 08:00: the deadline with a Friday 1:1. */
  friday: string
  /** Monday 08:00: the deadline with a Monday 1:1, or with no 1:1 booked. */
  monday: string
}

/** The 1:1 weekend of a week that opens at `opensAt`: from the first Friday on or after it, to the Tuesday after. */
export function oneOnOneWeek(opensAt: string): OneOnOneWeek {
  const o = schoolDay(new Date(opensAt))
  const fri = o.d + ((5 - o.weekday + 7) % 7)
  return {
    from: schoolTime(o.y, o.m, fri).toISOString(),
    to: schoolTime(o.y, o.m, fri + 4).toISOString(),
    friday: schoolTime(o.y, o.m, fri, DUE_HOUR).toISOString(),
    monday: schoolTime(o.y, o.m, fri + 3, DUE_HOUR).toISOString(),
  }
}

/** 08:00 school time on the day of a moment. */
function dueOnDayOf(at: string): string {
  const d = schoolDay(new Date(at))
  return schoolTime(d.y, d.m, d.d, DUE_HOUR).toISOString()
}

/** A student's deadline for a week, given the start times of the 1:1s they booked (any week; only that weekend's count). */
export function studentDeadline(opensAt: string, booked: string[]): { dueAt: string; dueFrom: DueFrom } {
  const week = oneOnOneWeek(opensAt)
  const from = new Date(week.from).getTime()
  const to = new Date(week.to).getTime()
  const first = booked
    .map((s) => new Date(s).getTime())
    .filter((t) => t >= from && t < to)
    .sort((a, b) => a - b)[0]
  return first === undefined
    ? { dueAt: week.monday, dueFrom: 'no_one_on_one' }
    : { dueAt: dueOnDayOf(new Date(first).toISOString()), dueFrom: 'one_on_one' }
}

/** The deadline as a number for sorting: a task without one goes last. */
export const dueTime = (a: Pick<AssignmentItem, 'dueAt'>) => (a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY)

/** Soonest deadline first; tasks without a deadline last. */
export function byDue(a: Pick<AssignmentItem, 'dueAt'>, b: Pick<AssignmentItem, 'dueAt'>): number {
  const x = dueTime(a)
  const y = dueTime(b)
  return x === y ? 0 : x < y ? -1 : 1
}

/** The deadline has passed (a task without a deadline is never overdue). */
export const isOverdue = (a: Pick<AssignmentItem, 'dueAt'>, now: Date) => !!a.dueAt && new Date(a.dueAt).getTime() < now.getTime()

/**
 * Each student's deadline for a task, as their mentor sees it: from the week and the 1:1s the student booked with them
 * (the mentor's slots say who booked what). A week without an opening date gives none.
 */
export function dueLookup(
  modules: Pick<CourseModule, 'id' | 'opensAt'>[],
  slots: { startsAt: string; bookedBy?: { id: number } }[],
): (task: Pick<AssignmentItem, 'moduleId' | 'dueAt' | 'dueFrom'>, studentId: number) => string | undefined {
  const opens = new Map(modules.map((m) => [m.id, m.opensAt]))
  const booked = new Map<number, string[]>()
  for (const s of slots) if (s.bookedBy) booked.set(s.bookedBy.id, [...(booked.get(s.bookedBy.id) ?? []), s.startsAt])
  return (task, studentId) => {
    const opensAt = opens.get(task.moduleId)
    return opensAt ? studentDeadline(opensAt, booked.get(studentId) ?? []).dueAt : undefined
  }
}

/** The course as staff see it: tasks have no deadline of their own (each student's follows their 1:1). */
export function withoutTaskDeadlines(modules: CourseModule[]): CourseModule[] {
  return modules.map((m) =>
    m.items.some((i) => i.type === 'assignment' && (i.dueAt || i.dueFrom))
      ? {
          ...m,
          items: m.items.map((i) => {
            if (i.type !== 'assignment') return i
            const next = { ...i }
            delete next.dueAt
            delete next.dueFrom
            return next
          }),
        }
      : m,
  )
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', weekday: 'short', day: 'numeric', month: 'short' })

/** "Fri 20 Nov or Mon 23 Nov, 08:00": when a week's work is due, for staff (each student by their own 1:1). */
export function weekDeadlineText(module: Pick<CourseModule, 'opensAt'>): string | null {
  if (!module.opensAt) return null
  const w = oneOnOneWeek(module.opensAt)
  return `${dayFmt.format(new Date(w.friday))} or ${dayFmt.format(new Date(w.monday))}, 08:00`
}

/** Why a student's deadline is when it is, in a few words. */
export const DUE_FROM_TEXT: Record<DueFrom, string> = {
  one_on_one: '08:00 on the day of your 1:1',
  no_one_on_one: 'no 1:1 booked yet, so Monday 08:00',
}

/** When the student's work is due, and why then ("the day of your 1:1", or no 1:1 booked yet). */
export function dueLine(a: Pick<AssignmentItem, 'dueAt' | 'dueFrom'>): string {
  if (!a.dueAt) return 'No deadline yet'
  const why = a.dueFrom === 'no_one_on_one' ? ' · no 1:1 booked yet' : a.dueFrom === 'one_on_one' ? ' · the day of your 1:1' : ''
  return `Due ${formatDateTime(a.dueAt)}${why}`
}

/** What a late hand-in means, as the student is told before and after handing in. */
export const LATE_RULE = 'Work handed in after your deadline is a late submission, and it makes your week grade red.'
