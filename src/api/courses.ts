import {
  addModule,
  listModules,
  type ModulePatch,
  putItem,
  putModule,
  quizAttemptsOf,
  removeItem,
  removeModule,
  saveQuizAttempt,
} from '../mocks/contentEdits'
import { handIn, submissionsOf } from '../mocks/submissions'
import type { ContentItem, CourseModule, QuizAttempt, QuizItem, ResourceItem, Submission, SubmissionFile } from '../types/course'
import { generateAiQuizFromMaterial } from '../utils/aiQuizClient'
import * as http from './courses.http'
import { hasBackend } from './http'

/**
 * Real backend when VITE_API_URL is set (./courses.http), the offline mock otherwise.
 * Real: loading the modules and their items, handing in work, module title/description, creating and
 * editing tasks, file materials and links, deleting items. The backend has no place yet for quizzes or
 * week dates: quizzes give a clear error, dates are sent and checked afterwards (datesNotKept).
 * Each authoring call returns the whole updated course (all modules), like a refetch would.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { ModulePatch }

/** Puts this student's own work (from the submissions store) on the tasks; nobody else's. */
function withWork(
  modules: CourseModule[],
  mine: Record<string, Submission>,
  attempts: Record<string, QuizAttempt> = {},
): CourseModule[] {
  return modules.map((m) => ({
    ...m,
    items: m.items.map((i) => {
      if (i.type === 'quiz') {
        const attempt = attempts[i.id]
        return attempt ? { ...i, attempt } : i
      }
      if (i.type !== 'assignment') return i
      const { submission: _demo, ...task } = i
      void _demo
      return mine[i.id] ? { ...task, submission: mine[i.id] } : task
    }),
  }))
}

/** `student` + `userId`: also load the student's own hand-ins. Staff get the course without anyone's work. */
export async function fetchModules(opts: { student?: boolean; userId?: number } = {}): Promise<CourseModule[]> {
  if (hasBackend()) return http.fetchModules(opts.student ?? false)
  await wait()
  const modules = listModules()
  const submissions = opts.student && opts.userId !== undefined ? submissionsOf(opts.userId) : {}
  const attempts = opts.userId !== undefined ? quizAttemptsOf(opts.userId) : {}
  return withWork(modules, submissions, attempts)
}

export interface SubmitPayload {
  textBody: string
  /** New files to upload. */
  files: File[]
  /** Files of the current version that are handed in again with the new one. */
  keep?: SubmissionFile[]
}

/** Who hands in, and the module the task belongs to (the backend's URL needs it). */
export interface SubmitContext {
  studentId?: number
  moduleId?: string
}

export async function submitWork(assignmentId: string, payload: SubmitPayload, ctx: SubmitContext = {}): Promise<Submission> {
  if (hasBackend()) {
    if (!ctx.moduleId) throw new Error('This task has no module')
    return http.submitWork(ctx.moduleId, assignmentId, payload)
  }
  await wait()
  const submission: Submission = {
    submittedAt: new Date().toISOString(),
    textBody: payload.textBody || undefined,
    files: [...(payload.keep ?? []), ...payload.files.map((f) => ({ name: f.name, sizeBytes: f.size }))],
  }
  // kept so the student's mentor can review it
  return ctx.studentId === undefined ? submission : handIn(ctx.studentId, assignmentId, submission)
}

export async function saveModule(id: string, patch: ModulePatch): Promise<CourseModule[]> {
  if (hasBackend()) return http.saveModule(id, patch)
  await wait()
  return putModule(id, patch)
}

export async function saveItem(item: ContentItem): Promise<CourseModule[]> {
  if (hasBackend()) return http.saveItem(item)
  await wait()
  return putItem(item)
}

/** A new module after the last one. Returns its id and the whole course. */
export async function createModule(
  patch: ModulePatch & { title: string },
  ctx: { createdBy?: number } = {},
): Promise<{ id: string; modules: CourseModule[] }> {
  if (hasBackend()) return http.createModule(patch)
  await wait()
  return addModule(patch, ctx.createdBy)
}

/** Makes someone the lecturer of a week (module), or takes the lecturer off it (null). Returns the whole course. */
export async function assignLecturer(moduleId: string, lecturerId: number | null): Promise<CourseModule[]> {
  if (hasBackend()) return http.assignLecturer(moduleId, lecturerId)
  await wait()
  return putModule(moduleId, { createdBy: lecturerId })
}

/** Admins (and the module's creator): the module and everything in it. */
export async function deleteModule(id: string): Promise<CourseModule[]> {
  if (hasBackend()) return http.deleteModule(id)
  await wait()
  return removeModule(id)
}

export async function deleteItem(id: string): Promise<CourseModule[]> {
  if (hasBackend()) return http.deleteItem(id)
  await wait()
  return removeItem(id)
}

export async function generateAiQuiz(
  input: { moduleId: string; contentItemId: string; title?: string; dueAt?: string },
  ctx: { createdBy?: number } = {},
): Promise<{ quizId: string; modules: CourseModule[] }> {
  if (hasBackend()) return http.generateAiQuiz(input)
  await wait()
  const mod = listModules().find((m) => m.id === input.moduleId)
  const material = mod?.items.find((i): i is ResourceItem => i.type === 'resource' && i.id === input.contentItemId)
  if (!material) throw new Error('Lesson material not found')

  const quizId = `ai-quiz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const pending: QuizItem = {
    id: quizId,
    moduleId: input.moduleId,
    type: 'quiz',
    title: input.title?.trim() || `AI Quiz: ${material.title}`,
    description: 'Generating 10 multiple-choice questions from lesson material...',
    dueAt: input.dueAt,
    status: 'generating',
    isAiGenerated: true,
    sourceContentItemId: material.id,
    createdBy: ctx.createdBy,
    questions: [],
  }
  const modules = putItem(pending)

  void generateAiQuizFromMaterial(material)
    .then((gen) => {
      putItem({
        ...pending,
        title: input.title?.trim() || gen.title,
        description: gen.description,
        status: 'ready',
        questions: gen.questions,
      })
    })
    .catch((err) => {
      putItem({
        ...pending,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'AI quiz generation failed',
      })
    })

  return { quizId, modules }
}

export async function submitQuizAttempt(
  quizId: string,
  answers: number[],
  ctx: { studentId?: number } = {},
): Promise<CourseModule[]> {
  if (hasBackend()) return http.submitQuizAttempt(quizId, answers)
  await wait()
  const userId = ctx.studentId ?? 0
  saveQuizAttempt(userId, quizId, answers)
  const submissions = submissionsOf(userId)
  const attempts = quizAttemptsOf(userId)
  return withWork(listModules(), submissions, attempts)
}
