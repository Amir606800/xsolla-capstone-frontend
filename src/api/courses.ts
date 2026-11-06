import { listModules, type ModulePatch, putItem, putModule, removeItem } from '../mocks/contentEdits'
import type { ContentItem, CourseModule, Submission } from '../types/course'
import * as http from './courses.http'
import { ApiError, hasBackend } from './http'

/**
 * Real backend when VITE_API_URL is set (./courses.http), the offline mock otherwise.
 * Real now (API_CONTRACT.md): loading the course, handing in work, deleting an item.
 * Mock only, because the contract has no place for them yet: creating/editing materials, tasks and quizzes,
 * and module details/dates. With a backend, lecturers get a clear error instead of a silent browser-only save.
 * Missing from the contract: quizzes, link materials, module open/close dates, per-task requirements, and
 * `max_points` (required there when creating a task, while the app rates weekly, not per task).
 * Each authoring call returns the whole updated course, like a refetch would.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { ModulePatch }

const notYet = () =>
  new ApiError(501, 'not_implemented', 'The backend cannot store this yet. Lecturer editing works in the offline demo only.')

/** `student`: also load the student's own hand-ins. */
export async function fetchModules(opts: { student?: boolean } = {}): Promise<CourseModule[]> {
  if (hasBackend()) return http.fetchModules(opts.student ?? false)
  await wait()
  return listModules()
}

export interface SubmitPayload {
  textBody: string
  files: File[]
}

export async function submitWork(assignmentId: string, payload: SubmitPayload): Promise<Submission> {
  if (hasBackend()) return http.submitWork(assignmentId, payload)
  await wait()
  return {
    submittedAt: new Date().toISOString(),
    textBody: payload.textBody || undefined,
    files: payload.files.map((f) => ({ name: f.name, sizeBytes: f.size })),
  }
}

export async function saveModule(id: string, patch: ModulePatch): Promise<CourseModule[]> {
  if (hasBackend()) throw notYet()
  await wait()
  return putModule(id, patch)
}

export async function saveItem(item: ContentItem): Promise<CourseModule[]> {
  if (hasBackend()) throw notYet()
  await wait()
  return putItem(item)
}

export async function deleteItem(id: string): Promise<CourseModule[]> {
  if (hasBackend()) return http.deleteItem(id)
  await wait()
  return removeItem(id)
}
