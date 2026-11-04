import { buildMockModules } from '../mocks/courses'
import type { CourseModule, Submission } from '../types/course'

/**
 * MOCK implementation - no backend yet.
 * Real versions:
 *  - fetchModules: GET /courses/:id/content-items merged with the student's
 *    submissions, run through `mapContentTree` (see ./mappers).
 *  - submitWork: upload each file via POST /files, then
 *    POST /content-items/:id/submissions { text_body, file_ids }.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function fetchModules(): Promise<CourseModule[]> {
  await wait()
  return buildMockModules()
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
