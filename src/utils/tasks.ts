import type { AssignmentItem, CourseModule } from '../types/course'
import { assignmentStatus, assignmentsOf } from './progress'
import type { AssignmentStatus } from './progress'

/** One assignment together with the module it belongs to. */
export interface TaskEntry {
  assignment: AssignmentItem
  module: CourseModule
  status: AssignmentStatus
}

/** What the filter buttons on the Tasks page offer. "todo" = open and not yet due. */
export type TaskFilter = 'all' | 'todo' | 'overdue' | 'submitted' | 'graded'

export const TASK_FILTERS: readonly TaskFilter[] = ['all', 'todo', 'overdue', 'submitted', 'graded']

export const FILTER_LABEL: Record<TaskFilter, string> = {
  all: 'All',
  todo: 'To do',
  overdue: 'Overdue',
  submitted: 'Submitted',
  graded: 'Graded',
}

const STATUS_OF_FILTER: Record<Exclude<TaskFilter, 'all'>, AssignmentStatus> = {
  todo: 'open',
  overdue: 'overdue',
  submitted: 'submitted',
  graded: 'graded',
}

export function isTaskFilter(value: string | null): value is TaskFilter {
  return value !== null && (TASK_FILTERS as readonly string[]).includes(value)
}

/** Every assignment of the given modules (callers pass only the modules the user may see). */
export function collectTasks(modules: CourseModule[], now: Date): TaskEntry[] {
  return modules.flatMap((module) =>
    assignmentsOf(module).map((assignment) => ({
      assignment,
      module,
      status: assignmentStatus(assignment, now),
    })),
  )
}

const PRIORITY: Record<AssignmentStatus, number> = { overdue: 0, open: 1, submitted: 2, graded: 3 }

/**
 * Work that needs action comes first: overdue, then open, soonest deadline first.
 * Finished work follows, most recent deadline first.
 */
export function sortTasks(entries: TaskEntry[]): TaskEntry[] {
  return [...entries].sort((a, b) => {
    const byPriority = PRIORITY[a.status] - PRIORITY[b.status]
    if (byPriority !== 0) return byPriority
    const byDue = a.assignment.dueAt.localeCompare(b.assignment.dueAt)
    return PRIORITY[a.status] <= 1 ? byDue : -byDue
  })
}

export function filterTasks(entries: TaskEntry[], filter: TaskFilter, moduleId: string | null): TaskEntry[] {
  return entries.filter(
    (e) =>
      (moduleId === null || e.module.id === moduleId) &&
      (filter === 'all' || e.status === STATUS_OF_FILTER[filter]),
  )
}

/** How many tasks each filter button would show (for the counts on the buttons). */
export function countTasks(entries: TaskEntry[], moduleId: string | null): Record<TaskFilter, number> {
  const counts = { all: 0, todo: 0, overdue: 0, submitted: 0, graded: 0 }
  for (const e of entries) {
    if (moduleId !== null && e.module.id !== moduleId) continue
    counts.all += 1
    if (e.status === 'open') counts.todo += 1
    else counts[e.status] += 1
  }
  return counts
}
