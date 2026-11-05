import { listModules, type ModulePatch, putItem, putModule, removeItem } from '../mocks/contentEdits'
import type { ContentItem, CourseModule, Submission } from '../types/course'

/**
 * MOCK implementation - no backend yet.
 * Real versions:
 *  - fetchModules: GET /courses/:id/content-items merged with the student's
 *    submissions, run through `mapContentTree` (see ./mappers). Students must never
 *    receive quiz answers (`correct`) or items of modules that have not opened.
 *  - submitWork: upload each file via POST /files, then
 *    POST /content-items/:id/submissions { text_body, file_ids }.
 *  - Lecturer authoring (teacher/admin only, the server checks the role):
 *      PATCH  /content-items/:moduleId             module title, description, open/close dates
 *      POST   /content-items {parent_id, type, ...} new material / task / quiz
 *      PATCH  /content-items/:id                   edit one
 *      DELETE /content-items/:id                   delete one
 *    Each authoring call here returns the whole updated course, like a refetch would.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { ModulePatch }

export async function fetchModules(): Promise<CourseModule[]> {
  await wait()
  return listModules()
}

export interface SubmitPayload {
  textBody: string
  files: File[]
}

export async function submitWork(_assignmentId: string, payload: SubmitPayload): Promise<Submission> {
  await wait()
  return {
    submittedAt: new Date().toISOString(),
    textBody: payload.textBody || undefined,
    files: payload.files.map((f) => ({ name: f.name, sizeBytes: f.size })),
  }
}

export async function saveModule(id: string, patch: ModulePatch): Promise<CourseModule[]> {
  await wait()
  return putModule(id, patch)
}

export async function saveItem(item: ContentItem): Promise<CourseModule[]> {
  await wait()
  return putItem(item)
}

export async function deleteItem(id: string): Promise<CourseModule[]> {
  await wait()
  return removeItem(id)
}
