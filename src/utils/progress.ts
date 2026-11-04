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
  scoreEarned: number
  scoreMax: number
  /** 0-100, graded work only */
  scorePercent: number
}

export interface DeadlineEntry {
  item: AssignmentItem
  moduleTitle: string
  overdue: boolean
}

export interface GradeEntry {
  item: AssignmentItem
  moduleTitle: string
  grade: number
  feedback?: string
  gradedAt: string
}

export function assignmentsOf(module: CourseModule): AssignmentItem[] {
  return module.items.filter((i): i is AssignmentItem => i.type === 'assignment')
}

export function resourcesOf(module: CourseModule): ResourceItem[] {
  return module.items.filter((i): i is ResourceItem => i.type === 'resource')
}

export type AssignmentStatus = 'open' | 'overdue' | 'submitted' | 'graded'

export function assignmentStatus(a: AssignmentItem, now: Date): AssignmentStatus {
  if (a.submission?.grade !== undefined) return 'graded'
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
  const graded = assignments.filter((a) => a.submission?.grade !== undefined).length
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
  let scoreEarned = 0
  let scoreMax = 0
  let modulesDone = 0

  for (const m of modules) {
    const p = moduleProgress(m, now)
    tasksTotal += p.total
    tasksSubmitted += p.submitted
    if (p.total > 0 && p.submitted === p.total) modulesDone += 1
    for (const a of assignmentsOf(m)) {
      if (a.submission?.grade !== undefined) {
        scoreEarned += a.submission.grade
        scoreMax += a.maxPoints
      }
    }
  }

  return {
    modulesDone,
    modulesTotal: modules.length,
    tasksSubmitted,
    tasksTotal,
    scoreEarned,
    scoreMax,
    scorePercent: scoreMax === 0 ? 0 : Math.round((scoreEarned / scoreMax) * 100),
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
      if (s?.grade !== undefined && s.gradedAt) {
        entries.push({
          item,
          moduleTitle: m.title,
          grade: s.grade,
          feedback: s.feedback,
          gradedAt: s.gradedAt,
        })
      }
    }
  }
  return entries.sort((a, b) => b.gradedAt.localeCompare(a.gradedAt)).slice(0, limit)
}
