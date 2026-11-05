import type { AssignmentItem, CourseModule, QuizItem, ResourceItem } from '../types/course'

/** Lecturer views of the course: where each module stands and what is still missing. */

export type ModulePhase = 'done' | 'running' | 'upcoming'

export function modulePhase(m: CourseModule, now: Date): ModulePhase {
  if (m.closesAt && new Date(m.closesAt) < now) return 'done'
  if (m.opensAt && new Date(m.opensAt) > now) return 'upcoming'
  return 'running'
}

export const PHASE_LABEL: Record<ModulePhase, string> = { done: 'Finished', running: 'Running now', upcoming: 'Upcoming' }

export interface ContentCounts {
  materials: number
  tasks: number
  quizzes: number
}

export function contentCounts(m: CourseModule): ContentCounts {
  let materials = 0
  let tasks = 0
  let quizzes = 0
  for (const i of m.items) {
    if (i.type === 'resource') materials++
    else if (i.type === 'assignment') tasks++
    else quizzes++
  }
  return { materials, tasks, quizzes }
}

export const materialsOf = (m: CourseModule) => m.items.filter((i): i is ResourceItem => i.type === 'resource')
export const tasksOf = (m: CourseModule) =>
  m.items.filter((i): i is AssignmentItem => i.type === 'assignment').sort((a, b) => a.dueAt.localeCompare(b.dueAt))
export const quizzesOf = (m: CourseModule) => m.items.filter((i): i is QuizItem => i.type === 'quiz')

export interface ContentGap {
  id: string
  moduleId: string
  position: number
  text: string
}

/**
 * What a lecturer still has to prepare in the running and upcoming modules: no tasks, no materials,
 * missing dates, or a task due outside the module's week. Finished modules are left alone.
 */
export function contentGaps(modules: CourseModule[], now: Date): ContentGap[] {
  const gaps: ContentGap[] = []
  const sorted = [...modules].sort((a, b) => a.position - b.position)
  for (const m of sorted) {
    if (modulePhase(m, now) === 'done') continue
    const add = (key: string, text: string) => gaps.push({ id: `${m.id}:${key}`, moduleId: m.id, position: m.position, text })
    const counts = contentCounts(m)
    if (!m.opensAt || !m.closesAt) add('dates', 'Has no start or end date')
    if (counts.materials === 0) add('materials', 'No materials yet')
    if (counts.tasks === 0) add('tasks', 'No tasks yet')
    for (const t of tasksOf(m)) {
      if (m.closesAt && t.dueAt > m.closesAt) add(`late-${t.id}`, `"${t.title}" is due after the module closes`)
      else if (m.opensAt && t.dueAt < m.opensAt) add(`early-${t.id}`, `"${t.title}" is due before the module opens`)
    }
  }
  return gaps
}

export interface DueTask {
  task: AssignmentItem
  module: CourseModule
}

/** The next deadlines across the whole course (lecturers see every module). */
export function nextDueTasks(modules: CourseModule[], now: Date, limit: number): DueTask[] {
  return modules
    .flatMap((module) => tasksOf(module).map((task) => ({ task, module })))
    .filter((d) => new Date(d.task.dueAt) > now)
    .sort((a, b) => a.task.dueAt.localeCompare(b.task.dueAt))
    .slice(0, limit)
}
