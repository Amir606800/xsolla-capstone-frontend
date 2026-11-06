import type { AssignmentItem, CourseModule, Submission } from '../types/course'
import type { TeamSubmission } from '../types/review'
import type { Person } from '../types/team'
import { buildMockModules } from './courses'
import { buildMentorTeam, MENTOR } from './teams'

/**
 * Stand-in for the backend's submissions table: every student's work on every task, kept in
 * localStorage so a student and their mentor using the same browser see each other's changes.
 * Tasks get no grade (the mentor grades the WEEK, see ./standings); the mentor reads the work and
 * may comment on it. Rules the real backend must enforce too:
 * - a student only ever reads and writes their own work
 * - a mentor reads and comments on the work of the students in THEIR team only
 * - a comment can be changed later; it does not lock the task
 */

export type StoredSubmission = TeamSubmission

const KEY = 'submissions'
const DAY = 86_400_000
const keyOf = (assignmentId: string, studentId: number) => `${assignmentId}:${studentId}`

type Store = Record<string, StoredSubmission>

const FEEDBACK = [
  'Works well. Add a couple of tests for the edge cases next time.',
  'Good structure. The README should explain how to run it.',
  'Nice and readable. Watch the error handling around user input.',
  'Solid work - split the long function into smaller ones.',
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function work(task: AssignmentItem, student: Person, team: string, submittedAt: Date): Submission {
  return {
    submittedAt: submittedAt.toISOString(),
    textBody: `Repo: https://github.com/xsolla-school/${team}/${slug(task.title)}\nI finished the main part; notes are in the README.`,
    files: (student.id + task.title.length) % 2 === 0 ? [{ name: `${slug(task.title)}.zip`, sizeBytes: 48_200 + student.id * 37 }] : [],
  }
}

/**
 * The demo history. Sam (id 1) gets exactly the work the course mock already shows him.
 * His teammates and Team 4: weeks 1-4 handed in with a comment, last week's work handed in without
 * one yet (one task missed, one late), and a few early hand-ins for this week.
 */
export function buildMockSubmissions(now: Date = new Date()): Store {
  const modules = buildMockModules(now)
  const store: Store = {}
  const put = (s: StoredSubmission) => {
    store[keyOf(s.assignmentId, s.studentId)] = s
  }
  const tasks = (m: CourseModule) => m.items.filter((i): i is AssignmentItem => i.type === 'assignment')

  for (const m of modules) {
    for (const t of tasks(m)) {
      if (!t.submission) continue
      const s = t.submission
      put({
        ...s,
        assignmentId: t.id,
        studentId: 1,
        ...(s.feedback ? { commentedAt: s.gradedAt ?? s.submittedAt, commentedBy: { id: MENTOR.id, name: MENTOR.name } } : {}),
      })
    }
  }

  const teams = [buildMentorTeam({ ...MENTOR }), buildMentorTeam({ id: 901, name: 'Aysel Mammadova', email: 'mentor@xsolla.school' })]
  for (const team of teams) {
    const label = team.name.toLowerCase().replace(' ', '-')
    team.members.forEach((student, si) => {
      if (student.id === 1) return
      for (const m of modules) {
        const week = m.position
        tasks(m).forEach((t, ti) => {
          const due = new Date(t.dueAt).getTime()
          if (week <= 4) {
            put({
              ...work(t, student, label, new Date(due - DAY)),
              assignmentId: t.id,
              studentId: student.id,
              feedback: FEEDBACK[(si + ti + week) % FEEDBACK.length],
              commentedAt: new Date(due + DAY).toISOString(),
              commentedBy: { id: team.mentor.id, name: team.mentor.name },
            })
          } else if (week === 5) {
            if (si === 1 && ti === 1) return // one missed task
            // the last one handed in a few hours late
            const at = si === 2 && ti === 0 ? due + 3 * 3_600_000 : due - (si + 1) * 3_600_000
            put({ ...work(t, student, label, new Date(at)), assignmentId: t.id, studentId: student.id })
          } else if (week === 6 && ti === 0 && si % 2 === 0 && new Date(due) > now) {
            put({ ...work(t, student, label, new Date(now.getTime() - (si + 2) * 3_600_000)), assignmentId: t.id, studentId: student.id })
          }
        })
      }
    })
  }
  return store
}

function load(now: Date): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    /* unreadable: fall back to the demo data */
  }
  const seed = buildMockSubmissions(now)
  save(seed)
  return seed
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage blocked or full: changes last until the page reloads */
  }
}

/** A student's own work, by task id. */
export function submissionsOf(studentId: number, now: Date = new Date()): Record<string, Submission> {
  const out: Record<string, Submission> = {}
  for (const s of Object.values(load(now))) {
    if (s.studentId !== studentId) continue
    out[s.assignmentId] = {
      submittedAt: s.submittedAt,
      ...(s.textBody !== undefined ? { textBody: s.textBody } : {}),
      ...(s.files !== undefined ? { files: s.files } : {}),
      ...(s.feedback !== undefined ? { feedback: s.feedback } : {}),
      ...(s.gradedAt !== undefined ? { gradedAt: s.gradedAt } : {}),
    }
  }
  return out
}

/**
 * A student hands in (or replaces) their work. The mentor's comment on the earlier version stays
 * until they write a new one. (Older demo work marked graded stays final.)
 */
export function handIn(studentId: number, assignmentId: string, submission: Submission, now: Date = new Date()): Submission {
  const store = load(now)
  const k = keyOf(assignmentId, studentId)
  const before = store[k]
  if (before?.gradedAt) throw new Error('This task has already been graded')
  const kept = before?.feedback
    ? { feedback: before.feedback, commentedAt: before.commentedAt, commentedBy: before.commentedBy }
    : {}
  store[k] = { ...submission, ...kept, assignmentId, studentId }
  save(store)
  return { ...submission, ...(before?.feedback ? { feedback: before.feedback } : {}) }
}

export interface Grader {
  id: number
  name: string
}

const teamIds = (mentor: Grader) => new Set(buildMentorTeam({ ...mentor, email: '' }).members.map((m) => m.id))

/** Everything the students of this mentor's team handed in. */
export function teamSubmissions(mentor: Grader, now: Date = new Date()): StoredSubmission[] {
  const ids = teamIds(mentor)
  return Object.values(load(now)).filter((s) => ids.has(s.studentId))
}

/** Mentor: writes or changes their comment on a student's work. It does not grade or lock the task. */
export function comment(
  mentor: Grader,
  studentId: number,
  assignmentId: string,
  text: string,
  now: Date = new Date(),
): StoredSubmission[] {
  if (!teamIds(mentor).has(studentId)) throw new Error('This student is not in your team')
  const body = text.trim()
  if (!body) throw new Error('Write a comment first')
  const store = load(now)
  const k = keyOf(assignmentId, studentId)
  const current = store[k]
  if (!current) throw new Error('This student has not handed anything in yet')
  store[k] = { ...current, feedback: body, commentedAt: now.toISOString(), commentedBy: { id: mentor.id, name: mentor.name } }
  save(store)
  return teamSubmissions(mentor, now)
}
