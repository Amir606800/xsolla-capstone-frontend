import type { CalendarEvent } from '../types/calendar'
import type { ContentItem, CourseModule, QuizAttempt, QuizItem } from '../types/course'
import { buildMockEvents } from './events'
import { lecturersOf } from '../utils/content'
import { orderByOpening } from '../utils/progress'
import { buildMockModules } from './courses'

/**
 * Stand-in for the backend while there is none: what a lecturer changes (modules, materials, tasks,
 * quizzes, calendar events) is kept in localStorage as a list of edits on top of the generated demo
 * data. The demo stays "live" (dates follow today) and a lecturer and a student who use the same
 * browser see each other's changes.
 */

/** `lecturerIds` replaces the week's lecturers (a week can have several). */
export type ModulePatch = Partial<Pick<CourseModule, 'title' | 'description' | 'opensAt' | 'closesAt' | 'lecturerIds'>>

interface CourseEdits {
  modules: Record<string, ModulePatch>
  /** A changed or new item, or null when it was deleted. */
  items: Record<string, ContentItem | null>
  /** Modules an admin deleted (with everything in them). */
  deletedModules?: string[]
  /** Modules an admin added; their items live in `items` like any other. */
  newModules?: Record<string, NewModule>
}

/** A module added on top of the demo course (it gets the next free position). */
type NewModule = Omit<CourseModule, 'position' | 'items'> & { createdAt: string }

const COURSE_KEY = 'course_edits'
const EVENTS_KEY = 'event_edits'
const QUIZ_ATTEMPTS_KEY = 'quiz_attempts'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked or full: the change lasts until the page reloads */
  }
}

let seq = 0
/** A new id that cannot clash with the generated demo ids. */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

const loadCourseEdits = (): CourseEdits => read<CourseEdits>(COURSE_KEY, { modules: {}, items: {} })

/** Students' work stays with the task when the lecturer edits it. */
function merge(base: ContentItem | undefined, edited: ContentItem): ContentItem {
  if (base?.type === 'assignment' && edited.type === 'assignment' && base.submission) {
    return { ...edited, submission: base.submission }
  }
  return edited
}

/** The demo modules plus the ones an admin added, numbered after the last demo module. */
function withAdded(base: CourseModule[], edits: CourseEdits): CourseModule[] {
  const last = base.reduce((max, m) => Math.max(max, m.position), 0)
  const added = Object.values(edits.newModules ?? {})
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m, i): CourseModule => ({ ...m, position: last + i + 1, items: [] }))
  return [...base, ...added]
}

export function applyCourseEdits(demo: CourseModule[], edits: CourseEdits): CourseModule[] {
  const base = withAdded(demo, edits)
  const baseItems = new Map<string, ContentItem>()
  for (const m of base) for (const i of m.items) baseItems.set(i.id, i)

  const deleted = new Set(edits.deletedModules ?? [])
  return base.filter((m) => !deleted.has(m.id)).map((m) => {
    const items: ContentItem[] = []
    for (const item of m.items) {
      const edited = edits.items[item.id]
      if (edited === null) continue // deleted
      if (edited === undefined) items.push(item)
      else if (edited.moduleId === m.id) items.push(merge(item, edited))
      // else: moved to another module, added there below
    }
    for (const [id, edited] of Object.entries(edits.items)) {
      if (!edited || edited.moduleId !== m.id) continue
      const original = baseItems.get(id)
      if (original && original.moduleId === m.id) continue // already placed above
      items.push(merge(original, edited))
    }
    const { lecturerIds, ...patch } = edits.modules[m.id] ?? {}
    const lecturers = lecturerIds ?? lecturersOf(m)
    return { ...m, ...patch, lecturerIds: lecturers, createdBy: lecturers[0], items }
  })
}

/** The course in the order the weeks open; each module's number follows that order. */
const numbered = (modules: CourseModule[]): CourseModule[] => orderByOpening(modules).map((m, i) => ({ ...m, position: i + 1 }))

export function listModules(now: Date = new Date()): CourseModule[] {
  return numbered(applyCourseEdits(buildMockModules(now), loadCourseEdits()))
}

/** A module that is in the demo course (or was added) and was not deleted. */
const exists = (id: string, edits: CourseEdits, now: Date) =>
  !edits.deletedModules?.includes(id) && (!!edits.newModules?.[id] || buildMockModules(now).some((m) => m.id === id))

/** Adds a module after the last one. Returns its id and the whole course. */
export function addModule(
  patch: ModulePatch & { title: string },
  createdBy?: number,
  now: Date = new Date(),
): { id: string; modules: CourseModule[] } {
  const edits = loadCourseEdits()
  const id = newId('module')
  const { lecturerIds: _ignored, ...fields } = patch
  void _ignored
  edits.newModules = {
    ...edits.newModules,
    [id]: { id, ...fields, ...(createdBy !== undefined ? { createdBy } : {}), createdAt: now.toISOString() },
  }
  write(COURSE_KEY, edits)
  return { id, modules: listModules(now) }
}

export function putModule(id: string, patch: ModulePatch, now: Date = new Date()): CourseModule[] {
  const edits = loadCourseEdits()
  if (!exists(id, edits, now)) throw new Error('This module does not exist')
  edits.modules[id] = { ...edits.modules[id], ...patch }
  write(COURSE_KEY, edits)
  return listModules(now)
}

/** Adds a lecturer to the week (or takes them off it); the other lecturers stay. */
export function setLecturer(moduleId: string, lecturerId: number, assigned: boolean, now: Date = new Date()): CourseModule[] {
  const current = lecturersOf(listModules(now).find((m) => m.id === moduleId))
  const next = assigned ? [...new Set([...current, lecturerId])] : current.filter((id) => id !== lecturerId)
  return putModule(moduleId, { lecturerIds: next }, now)
}

/** Creates or replaces an item. Students' submissions are never part of what the lecturer saves. */
export function putItem(item: ContentItem, now: Date = new Date()): CourseModule[] {
  const edits = loadCourseEdits()
  if (!exists(item.moduleId, edits, now)) throw new Error('This module does not exist')
  // student work never travels with a lecturer edit; a picked File cannot be stored (the mock keeps name and size)
  const clean: ContentItem =
    item.type === 'assignment' ? { ...item, submission: undefined } : item.type === 'resource' ? { ...item, upload: undefined } : item
  edits.items[item.id] = clean
  write(COURSE_KEY, edits)
  return listModules(now)
}

/** Deletes a whole module and what is in it (students' handed-in work stays in its own store). */
export function removeModule(id: string, now: Date = new Date()): CourseModule[] {
  const edits = loadCourseEdits()
  if (!exists(id, edits, now)) throw new Error('This module does not exist')
  edits.deletedModules = [...(edits.deletedModules ?? []), id]
  write(COURSE_KEY, edits)
  return listModules(now)
}

export function removeItem(id: string, now: Date = new Date()): CourseModule[] {
  const edits = loadCourseEdits()
  edits.items[id] = null
  write(COURSE_KEY, edits)
  return listModules(now)
}

export function quizAttemptsOf(userId: number): Record<string, QuizAttempt> {
  const all = read<Record<string, Record<string, QuizAttempt>>>(QUIZ_ATTEMPTS_KEY, {})
  return all[String(userId)] ?? {}
}

export function saveQuizAttempt(userId: number, quizId: string, answers: number[], now: Date = new Date()): QuizAttempt {
  const quiz = listModules(now)
    .flatMap((m) => m.items)
    .find((i): i is QuizItem => i.type === 'quiz' && i.id === quizId)
  if (!quiz || !quiz.questions?.length) {
    throw new Error('Quiz is not ready yet')
  }
  if (answers.length !== quiz.questions.length) {
    throw new Error(`Please answer all ${quiz.questions.length} questions`)
  }
  let score = 0
  for (let i = 0; i < quiz.questions.length; i++) {
    if (answers[i] === quiz.questions[i].correct) score++
  }
  const attempt: QuizAttempt = {
    id: `attempt-${Date.now()}`,
    quizId,
    answers,
    score,
    total: quiz.questions.length,
    submittedAt: new Date().toISOString(),
  }
  const all = read<Record<string, Record<string, QuizAttempt>>>(QUIZ_ATTEMPTS_KEY, {})
  all[String(userId)] = { ...(all[String(userId)] ?? {}), [quizId]: attempt }
  write(QUIZ_ATTEMPTS_KEY, all)
  return attempt
}

// ---------- calendar events ----------

type EventEdits = Record<string, CalendarEvent | null>

export function applyEventEdits(base: CalendarEvent[], edits: EventEdits): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const e of base) {
    const edited = edits[e.id]
    if (edited === null) continue
    out.push(edited ?? e)
  }
  const baseIds = new Set(base.map((e) => e.id))
  for (const [id, edited] of Object.entries(edits)) if (edited && !baseIds.has(id)) out.push(edited)
  return out
}

export function listEvents(now: Date = new Date()): CalendarEvent[] {
  return applyEventEdits(buildMockEvents(now), read<EventEdits>(EVENTS_KEY, {}))
}

export function putEvent(event: CalendarEvent, now: Date = new Date()): CalendarEvent[] {
  const edits = read<EventEdits>(EVENTS_KEY, {})
  edits[event.id] = event
  write(EVENTS_KEY, edits)
  return listEvents(now)
}

export function removeEvent(id: string, now: Date = new Date()): CalendarEvent[] {
  const edits = read<EventEdits>(EVENTS_KEY, {})
  edits[id] = null
  write(EVENTS_KEY, edits)
  return listEvents(now)
}
