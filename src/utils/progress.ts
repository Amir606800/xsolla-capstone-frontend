import type { AssignmentItem, CourseModule, ResourceItem } from '../types/course'

const HOUR = 3_600_000
export const URGENT_WITHIN_MS = 48 * HOUR

export type ModuleStatus = 'not-started' | 'in-progress' | 'submitted' | 'completed' | 'overdue'

export interface ModuleProgress {
  total: number
  submitted: number
  graded: number
  percent: number
  status: ModuleStatus
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

export function assignmentStatus(a: AssignmentItem, now: Date): AssignmentStatus {
  if (a.submission?.gradedAt !== undefined) return 'graded'
  if (a.submission) return 'submitted'
  return new Date(a.dueAt) < now ? 'overdue' : 'open'
}

/** Module window for display: explicit dates win, otherwise derived from its assignments. */
export function moduleWindow(module: CourseModule): { opensAt?: string; dueAt?: string } {
  const dues = assignmentsOf(module)
    .map((a) => a.dueAt)
    .sort()
  return {
    opensAt: module.opensAt,
    dueAt: module.closesAt ?? dues[dues.length - 1],
  }
}

export function moduleProgress(module: CourseModule, now: Date): ModuleProgress {
  const assignments = assignmentsOf(module)
  const total = assignments.length
  const submitted = assignments.filter((a) => a.submission).length
  const graded = assignments.filter((a) => a.submission?.gradedAt !== undefined).length
  const percent = total === 0 ? 0 : Math.round((submitted / total) * 100)
  const overdue = assignments.some((a) => !a.submission && new Date(a.dueAt) < now)

  let status: ModuleStatus
  if (overdue) status = 'overdue'
  else if (total === 0 || submitted === 0) status = 'not-started'
  else if (submitted < total) status = 'in-progress'
  else if (graded === total) status = 'completed'
  else status = 'submitted'

  return { total, submitted, graded, percent, status }
}

/** Earliest unsubmitted deadline in the module (an overdue one counts and wins). */
export function nextDeadline(module: CourseModule, now: Date): NextDeadline | null {
  const open = assignmentsOf(module)
    .filter((a) => !a.submission)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  if (open.length === 0) return null
  const dueAt = open[0].dueAt
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
    if (p.total > 0 && p.submitted === p.total) modulesDone += 1
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
        entries.push({ item, moduleTitle: m.title, overdue: new Date(item.dueAt) < now })
      }
    }
  }
  return entries.sort((a, b) => a.item.dueAt.localeCompare(b.item.dueAt)).slice(0, limit)
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
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
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
