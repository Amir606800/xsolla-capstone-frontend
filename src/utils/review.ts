import type { AssignmentItem, CourseModule, QuizItem } from '../types/course'
import type { TeamSubmission } from '../types/review'
import type { StandingLevel, WeeklyStanding } from '../types/standing'
import type { Person } from '../types/team'
import { analyseStandings, RED_LIMIT, YELLOW_LIMIT } from './standing'

/*
 * The mentor's week: tasks get no grade - the mentor reads the work and may comment - and each
 * student gets ONE green / yellow / red grade for the whole week.
 */

// ---------- tasks: who handed in what, and has the mentor commented ----------

export type WorkStatus = 'new' | 'commented' | 'missing' | 'not-yet'

export interface WorkRow {
  student: Person
  task: AssignmentItem
  submission?: TeamSubmission
  status: WorkStatus
  /** Handed in after the deadline. */
  late: boolean
}

export const tasksOf = (m: CourseModule) => m.items.filter((i): i is AssignmentItem => i.type === 'assignment')

const keyOf = (assignmentId: string, studentId: number) => `${assignmentId}:${studentId}`

export function indexSubmissions(list: TeamSubmission[]): Map<string, TeamSubmission> {
  return new Map(list.map((s) => [keyOf(s.assignmentId, s.studentId), s]))
}

export function workRow(task: AssignmentItem, student: Person, index: Map<string, TeamSubmission>, now: Date): WorkRow {
  const submission = index.get(keyOf(task.id, student.id))
  const status: WorkStatus = submission
    ? submission.feedback
      ? 'commented'
      : 'new'
    : new Date(task.dueAt) < now
      ? 'missing'
      : 'not-yet'
  const late = !!submission && new Date(submission.submittedAt) > new Date(task.dueAt)
  return { student, task, submission, status, late }
}

const ORDER: Record<WorkStatus, number> = { new: 0, missing: 1, 'not-yet': 2, commented: 3 }

/** One task's rows: new work first, then missing work, then the rest; by name inside. */
export function taskRows(task: AssignmentItem, students: Person[], index: Map<string, TeamSubmission>, now: Date): WorkRow[] {
  return students
    .map((s) => workRow(task, s, index, now))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.student.name.localeCompare(b.student.name))
}

/** How much of the week's work a student handed in. */
export function handedIn(module: CourseModule, student: Person, index: Map<string, TeamSubmission>): { done: number; total: number } {
  const tasks = tasksOf(module)
  return { done: tasks.filter((t) => index.has(keyOf(t.id, student.id))).length, total: tasks.length }
}

/** Work handed in that the mentor has not commented on yet, across all weeks. */
export function newWork(modules: CourseModule[], students: Person[], list: TeamSubmission[], now: Date): (WorkRow & { module: CourseModule })[] {
  const index = indexSubmissions(list)
  const out: (WorkRow & { module: CourseModule })[] = []
  for (const module of modules)
    for (const task of tasksOf(module))
      for (const s of students) {
        const row = workRow(task, s, index, now)
        if (row.status === 'new') out.push({ ...row, module })
      }
  return out
}

/** The week's quizzes a student can take (ones still being written by the AI, or that failed, are not shown). */
export const quizzesOf = (m: CourseModule) => m.items.filter((i): i is QuizItem => i.type === 'quiz' && (!i.status || i.status === 'ready'))

/** One student's week in numbers, for the card. */
export function studentWeek(module: CourseModule, student: Person, workIndex: Map<string, TeamSubmission>, now: Date) {
  const rows = tasksOf(module).map((t) => workRow(t, student, workIndex, now))
  return {
    total: rows.length,
    done: rows.filter((r) => r.submission).length,
    fresh: rows.filter((r) => r.status === 'new').length,
    missing: rows.filter((r) => r.status === 'missing').length,
  }
}

// ---------- the week grade ----------

export type WeekPhase = 'upcoming' | 'running' | 'finished'

export function weekPhase(m: CourseModule, now: Date): WeekPhase {
  if (m.opensAt && new Date(m.opensAt) > now) return 'upcoming'
  if (m.closesAt && new Date(m.closesAt) < now) return 'finished'
  return m.opensAt ? 'running' : 'finished'
}

/**
 * Once a week has closed, a grade that was given stays as it is. While the week runs the mentor can still change it,
 * and a closed week that was never graded can still get its grade.
 */
export const gradeLocked = (m: CourseModule, grade: WeeklyStanding | undefined, now: Date) =>
  grade !== undefined && weekPhase(m, now) === 'finished'

export type StandingIndex =Map<string, WeeklyStanding>
const gradeKey = (studentId: number, week: number) => `${studentId}:${week}`

export function indexStandings(list: (WeeklyStanding & { studentId: number })[]): StandingIndex {
  return new Map(list.map((s) => [gradeKey(s.studentId, s.week), s]))
}

export const weekGradeOf = (index: StandingIndex, studentId: number, week: number) => index.get(gradeKey(studentId, week))

export interface GradeDue {
  student: Person
  module: CourseModule
}

/** Finished weeks a student has no grade for yet, the oldest week first. */
export function gradesDue(modules: CourseModule[], students: Person[], index: StandingIndex, now: Date): GradeDue[] {
  return [...modules]
    .sort((a, b) => a.position - b.position)
    .filter((m) => weekPhase(m, now) === 'finished')
    .flatMap((module) =>
      students.filter((s) => !weekGradeOf(index, s.id, module.position)).map((student) => ({ student, module })),
    )
}

/** Students of the team still without a grade for this week (0 for weeks that have not started). */
export function ungradedCount(module: CourseModule, students: Person[], index: StandingIndex, now: Date): number {
  if (weekPhase(module, now) === 'upcoming') return 0
  return students.filter((s) => !weekGradeOf(index, s.id, module.position)).length
}

/**
 * The week to open the grading page on: the oldest finished week that still needs grades,
 * otherwise the week running now, otherwise the first one.
 */
export function defaultWeek(modules: CourseModule[], students: Person[], index: StandingIndex, now: Date): CourseModule | undefined {
  const sorted = [...modules].sort((a, b) => a.position - b.position)
  return gradesDue(sorted, students, index, now)[0]?.module ?? sorted.find((m) => weekPhase(m, now) === 'running') ?? sorted[0]
}

/**
 * What a grade would set off under the program rules (4 yellow weeks in a row count as red,
 * 2 red weeks in a row mean removal), given the student's other weeks. Null when nothing.
 */
export function gradeWarning(theirWeeks: WeeklyStanding[], week: number, level: StandingLevel): string | null {
  const upTo = [...theirWeeks.filter((w) => w.week < week), { week, level, assessedAt: '' }]
  const summary = analyseStandings(upTo)
  const last = summary.weeks[summary.weeks.length - 1]
  if (summary.removal) return `This is ${RED_LIMIT} red weeks in a row: by the program rules the student is removed.`
  if (last?.escalated) return `This is the ${YELLOW_LIMIT}th yellow week in a row, so it counts as red.`
  if (level === 'yellow' && summary.yellowStreak === YELLOW_LIMIT - 1) {
    return `${summary.yellowStreak} yellow weeks in a row. One more counts as red.`
  }
  return null
}

/** Id of one student's row under one task, used in links (`?open=`) and element ids. */
export const rowId = (assignmentId: string, studentId: number) => `${assignmentId}~${studentId}`
