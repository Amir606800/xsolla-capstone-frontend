import type { AssignmentItem, CourseModule, ResourceItem } from '../types/course'
import { byDue, isOverdue } from './deadline'

const HOUR = 3_600_000
export const URGENT_WITHIN_MS = 48 * HOUR

export type ModuleStatus = 'not-started' | 'in-progress' | 'submitted' | 'completed' | 'overdue'

export interface ModuleProgress {
  total: number
  submitted: number
  graded: number
  percent: number
  status: ModuleStatus
  /** An open module with nothing to hand in (a lecture week): it counts as done by itself. */
  noTasks: boolean
}

export interface NextDeadline {
  dueAt: string
  urgent: boolean
}

export interface OverallStats {
  modulesDone: number
  modulesTotal: number
  tasksSubmitted: number
  tasksTotal: number
}

export interface DeadlineEntry {
  item: AssignmentItem
  moduleTitle: string
  overdue: boolean
}

export interface GradeEntry {
  item: AssignmentItem
  moduleTitle: string
  feedback?: string
  gradedAt: string
}

export function assignmentsOf(module: CourseModule): AssignmentItem[] {
  return module.items.filter((i): i is AssignmentItem => i.type === 'assignment')
}

export function resourcesOf(module: CourseModule): ResourceItem[] {
  return module.items.filter((i): i is ResourceItem => i.type === 'resource')
}

/**
 * A module that has not opened yet. Students must not see its content;
 * a module without an `opensAt` date is always open.
 * Once a module has closed it stays open, and work can still be handed in (late, if the student's deadline passed).
 */
export function isModuleLocked(module: CourseModule, now: Date): boolean {
  return module.opensAt !== undefined && new Date(module.opensAt) > now
}

/** The module whose opening..closing window contains `now` ("this week"). */
export function isActiveModule(module: CourseModule, now: Date): boolean {
  if (!module.opensAt || !module.closesAt) return false
  return new Date(module.opensAt) <= now && now <= new Date(module.closesAt)
}

export type AssignmentStatus = 'open' | 'overdue' | 'submitted' | 'graded'

/**
 * Modules in the order they open (the earliest first), then by when they were made. A module's number ("Module 3",
 * "Week 3") is its place in this order, so a module that opens earlier is never listed after one that opens later.
 * Modules without an opening date go last, in the order they were made.
 */
export function orderByOpening<T extends { id: string; opensAt?: string; createdAt?: string }>(modules: T[]): T[] {
  const at = (m: T) => (m.opensAt ? new Date(m.opensAt).getTime() : Number.POSITIVE_INFINITY)
  return [...modules].sort(
    (a, b) =>
      (at(a) === at(b) ? 0 : at(a) < at(b) ? -1 : 1) ||
      (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
      Number(a.id) - Number(b.id) ||
      a.id.localeCompare(b.id),
  )
}

export function assignmentStatus(a: AssignmentItem, now: Date): AssignmentStatus {
  if (a.submission?.gradedAt !== undefined) return 'graded'
  if (a.submission) return 'submitted'
  return isOverdue(a, now) ? 'overdue' : 'open'
}

/**
 * The week for display: when it opened and when the student's work is due. Every task of a week is due at the same
 * moment (08:00 on the day of the student's 1:1), and the module's closing date plays no part.
 */
export function moduleWindow(module: CourseModule): { opensAt?: string; dueAt?: string } {
  return { opensAt: module.opensAt, dueAt: [...assignmentsOf(module)].sort(byDue)[0]?.dueAt }
}

export function moduleProgress(module: CourseModule, now: Date): ModuleProgress {
  const assignments = assignmentsOf(module)
  const total = assignments.length

  // a lecture week has nothing to hand in, so once it has opened it counts as done (and a quiz is not a hand-in)
  if (total === 0 && !isModuleLocked(module, now)) {
    return { total, submitted: 0, graded: 0, percent: 100, status: 'completed', noTasks: true }
  }

  const submitted = assignments.filter((a) => a.submission).length
  const graded = assignments.filter((a) => a.submission?.gradedAt !== undefined).length
  const percent = total === 0 ? 0 : Math.round((submitted / total) * 100)
  const overdue = assignments.some((a) => !a.submission && isOverdue(a, now))

  let status: ModuleStatus
  if (overdue) status = 'overdue'
  else if (total === 0 || submitted === 0) status = 'not-started'
  else if (submitted < total) status = 'in-progress'
  else if (graded === total) status = 'completed'
  else status = 'submitted'

  return { total, submitted, graded, percent, status, noTasks: false }
}

/** Earliest unsubmitted deadline in the module (an overdue one counts and wins). */
export function nextDeadline(module: CourseModule, now: Date): NextDeadline | null {
  const dueAt = assignmentsOf(module)
    .filter((a) => !a.submission && a.dueAt)
    .sort(byDue)[0]?.dueAt
  if (!dueAt) return null
  return { dueAt, urgent: new Date(dueAt).getTime() - now.getTime() < URGENT_WITHIN_MS }
}

export function overallStats(modules: CourseModule[], now: Date): OverallStats {
  let tasksTotal = 0
  let tasksSubmitted = 0
  let modulesDone = 0

  for (const m of modules) {
    const p = moduleProgress(m, now)
    tasksTotal += p.total
    tasksSubmitted += p.submitted
    if (p.noTasks || (p.total > 0 && p.submitted === p.total)) modulesDone += 1
  }

  return {
    modulesDone,
    modulesTotal: modules.length,
    tasksSubmitted,
    tasksTotal,
  }
}

/** Unsubmitted assignments, soonest first (overdue ones come first, flagged). */
export function upcomingDeadlines(modules: CourseModule[], now: Date, limit: number): DeadlineEntry[] {
  const entries: DeadlineEntry[] = []
  for (const m of modules) {
    for (const item of assignmentsOf(m)) {
      if (!item.submission) {
        entries.push({ item, moduleTitle: m.title, overdue: isOverdue(item, now) })
      }
    }
  }
  return entries.sort((a, b) => byDue(a.item, b.item)).slice(0, limit)
}

/** Most recently graded work first. */
export function recentGrades(modules: CourseModule[], limit: number): GradeEntry[] {
  const entries: GradeEntry[] = []
  for (const m of modules) {
    for (const item of assignmentsOf(m)) {
      const s = item.submission
      if (s?.gradedAt !== undefined) {
        entries.push({
          item,
          moduleTitle: m.title,
          feedback: s.feedback,
          gradedAt: s.gradedAt,
        })
      }
    }
  }
  return entries.sort((a, b) => b.gradedAt.localeCompare(a.gradedAt)).slice(0, limit)
}

/** The assignment the student should do next in a module: earliest unsubmitted one. */
export function nextAssignment(module: CourseModule): AssignmentItem | null {
  const open = assignmentsOf(module)
    .filter((a) => !a.submission)
    .sort(byDue)
  return open[0] ?? null
}

export type ActivityKind = 'submitted' | 'graded' | 'opened'

export interface ActivityEntry {
  /** Unique per event, e.g. "graded:a6-1". */
  id: string
  kind: ActivityKind
  title: string
  moduleId: string
  moduleTitle: string
  at: string // ISO
}

/**
 * What happened lately, newest first: work handed in, work graded and modules that opened.
 * Only events that already happened are listed (a module opening next week is not activity).
 */
export function recentActivity(modules: CourseModule[], now: Date, limit: number): ActivityEntry[] {
  const entries: ActivityEntry[] = []
  for (const m of modules) {
    if (m.opensAt && new Date(m.opensAt) <= now) {
      entries.push({
        id: `opened:${m.id}`,
        kind: 'opened',
        title: `Module ${m.position} opened`,
        moduleId: m.id,
        moduleTitle: m.title,
        at: m.opensAt,
      })
    }
    for (const a of assignmentsOf(m)) {
      const s = a.submission
      if (!s) continue
      const base = { title: a.title, moduleId: m.id, moduleTitle: m.title }
      entries.push({ ...base, id: `submitted:${a.id}`, kind: 'submitted', at: s.submittedAt })
      if (s.gradedAt !== undefined) {
        entries.push({ ...base, id: `graded:${a.id}`, kind: 'graded', at: s.gradedAt })
      }
    }
  }
  return entries
    .filter((e) => new Date(e.at) <= now)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}
