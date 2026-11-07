import { addModule, listModules, type ModulePatch, putItem, putModule, removeItem, removeModule } from '../mocks/contentEdits'
import { handIn, submissionsOf } from '../mocks/submissions'
import type { ContentItem, CourseModule, Submission } from '../types/course'
import * as http from './courses.http'
import { hasBackend } from './http'

/**
 * Real backend when VITE_API_URL is set (./courses.http), the offline mock otherwise.
 * Real: loading the modules and their items, handing in work, module title/description, creating and
 * editing tasks and file materials, deleting items. The backend has no place yet for quizzes, link
 * materials or week dates; with a backend those give a clear error instead of a browser-only save.
 * Each authoring call returns the whole updated course (all modules), like a refetch would.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { ModulePatch }

/** Puts this student's own work (from the submissions store) on the tasks; nobody else's. */
function withWork(modules: CourseModule[], mine: Record<string, Submission>): CourseModule[] {
  return modules.map((m) => ({
    ...m,
    items: m.items.map((i) => {
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
  return withWork(modules, opts.student && opts.userId !== undefined ? submissionsOf(opts.userId) : {})
}

export interface SubmitPayload {
  textBody: string
  files: File[]
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
    files: payload.files.map((f) => ({ name: f.name, sizeBytes: f.size })),
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
