import type { CalendarEvent } from '../types/calendar'
import type { AssignmentItem, CourseModule } from '../types/course'
import { isSchoolEvent } from './adminCalendar'
import { isActiveModule } from './progress'

/**
 * Which week the admin's overview shows, and what is in it.
 *  - current:  a module's opening..closing window contains now
 *  - next:     between weeks or before the program starts: the one that opens next
 *  - last:     the program is over: the last week
 *  - undated:  modules exist but none has week dates (the backend does not send them yet), so "this week" cannot be told
 *  - none:     there are no modules
 */
export type WeekState = 'current' | 'next' | 'last' | 'undated' | 'none'

export interface WeekSummary {
  state: WeekState
  module?: CourseModule
  /** The lecturer teaching the week (user id), if one is set. */
  lecturerId?: number
  /** "Day 3 of 7" while the week is on. */
  day?: { number: number; of: number }
  /** Lectures, meetings and off-campus days in the week, by time. */
  events: CalendarEvent[]
  /** The week's tasks, by deadline. */
  tasks: AssignmentItem[]
  resources: number
  quizzes: number
}

const DAY = 86_400_000
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

const dated = (m: CourseModule): m is CourseModule & { opensAt: string; closesAt: string } => !!m.opensAt && !!m.closesAt

function describe(module: CourseModule, state: WeekState, events: CalendarEvent[], now: Date): WeekSummary {
  const from = module.opensAt ? new Date(module.opensAt).getTime() : null
  const to = module.closesAt ? new Date(module.closesAt).getTime() : null
  // an event belongs to the week by its module, or (the server sets no module on a lecture) by its time
  const inWeek = events
    .filter((e) => {
      if (!isSchoolEvent(e)) return false
      if (e.moduleId === module.id) return true
      const start = new Date(e.startsAt).getTime()
      return from !== null && to !== null && start >= from && start <= to
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title))

  const tasks = module.items.filter((i): i is AssignmentItem => i.type === 'assignment').sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const total = from !== null && to !== null ? Math.max(1, Math.round((midnight(new Date(to)) - midnight(new Date(from))) / DAY) + 1) : 7
  return {
    state,
    module,
    ...(module.createdBy !== undefined ? { lecturerId: module.createdBy } : {}),
    ...(state === 'current' && from !== null ? { day: { number: Math.min(total, Math.round((midnight(now) - midnight(new Date(from))) / DAY) + 1), of: total } } : {}),
    events: inWeek,
    tasks,
    resources: module.items.filter((i) => i.type === 'resource').length,
    quizzes: module.items.filter((i) => i.type === 'quiz').length,
  }
}

/** The week to show on the admin's overview. */
export function weekSummary(modules: CourseModule[], events: CalendarEvent[], now: Date): WeekSummary {
  const empty = { events: [], tasks: [], resources: 0, quizzes: 0 }
  if (modules.length === 0) return { state: 'none', ...empty }

  const current = modules.find((m) => isActiveModule(m, now))
  if (current) return describe(current, 'current', events, now)

  const withDates = modules.filter(dated)
  if (withDates.length === 0) return { state: 'undated', ...empty }

  const next = withDates.filter((m) => new Date(m.opensAt) > now).sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0]
  if (next) return describe(next, 'next', events, now)

  const last = [...withDates].sort((a, b) => b.closesAt.localeCompare(a.closesAt))[0]
  return describe(last, 'last', events, now)
}
