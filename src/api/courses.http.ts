import type { CourseModule, Submission } from '../types/course'
import { authedRequest } from './authed'
import { ApiError } from './http'
import { mapContentTree, mapSubmission } from './mappers'
import type { ApiContentItem, ApiCourse, ApiFile, ApiSubmission } from './types'

/**
 * Real calls, written against API_CONTRACT.md. Only what the contract fully covers:
 *   GET    /courses
 *   GET    /courses/:id/content-items
 *   GET    /content-items/:id/submissions/me
 *   POST   /files                                         (multipart, field "file")
 *   POST   /courses/:id/content-items/:assignmentId/submissions
 *   DELETE /content-items/:id
 * The app shows ONE course: the first one the server lists for the signed-in user.
 */

async function currentCourseId(): Promise<string | null> {
  const courses = await authedRequest<ApiCourse[]>('/courses')
  return courses.length > 0 ? String(courses[0].id) : null
}

function assignmentIds(nodes: ApiContentItem[]): string[] {
  return nodes.flatMap((n) =>
    n.type === 'section' ? assignmentIds(n.children) : n.type === 'assignment' ? [String(n.id)] : [],
  )
}

/** The student's own work on one task; 404 simply means nothing handed in yet. */
async function mySubmission(assignmentId: string): Promise<ApiSubmission | undefined> {
  try {
    return await authedRequest<ApiSubmission>(`/content-items/${assignmentId}/submissions/me`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined
    throw e
  }
}

/** `withSubmissions`: students also get their own hand-ins (one request per task; teachers and admins have none). */
export async function fetchModules(withSubmissions: boolean): Promise<CourseModule[]> {
  const courseId = await currentCourseId()
  if (!courseId) return []
  const tree = await authedRequest<ApiContentItem[]>(`/courses/${courseId}/content-items`)
  const mine: Record<string, ApiSubmission | undefined> = {}
  if (withSubmissions) {
    const ids = assignmentIds(tree)
    const found = await Promise.all(ids.map(mySubmission))
    ids.forEach((id, i) => {
      mine[id] = found[i]
    })
  }
  return mapContentTree(tree, mine)
}

export interface SubmitPayload {
  textBody: string
  files: File[]
}

export async function submitWork(assignmentId: string, payload: SubmitPayload): Promise<Submission> {
  const courseId = await currentCourseId()
  if (!courseId) throw new ApiError(404, 'not_found', 'You are not enrolled in a course yet')

  // files first: the submission refers to them by id
  const fileIds: string[] = []
  for (const file of payload.files) {
    const form = new FormData()
    form.append('file', file)
    const uploaded = await authedRequest<ApiFile>('/files', { method: 'POST', body: form })
    fileIds.push(String(uploaded.id))
  }

  const res = await authedRequest<ApiSubmission>(`/courses/${courseId}/content-items/${assignmentId}/submissions`, {
    method: 'POST',
    body: { ...(payload.textBody ? { text_body: payload.textBody } : {}), file_ids: fileIds },
  })
  return { ...mapSubmission(res), files: payload.files.map((f) => ({ name: f.name, sizeBytes: f.size })) }
}

export async function deleteItem(id: string): Promise<CourseModule[]> {
  await authedRequest<void>(`/content-items/${id}`, { method: 'DELETE' })
  return fetchModules(false)
}
