import type { AssignmentItem, ContentItem, CourseModule, QuizItem, ResourceItem, Submission, SubmissionFile } from '../types/course'
import { type UserDto, mapUser } from './auth.http'
import { authedRequest } from './authed'
import { ApiError } from './http'
import { isServerId, joinDescription, mapModules, mapSubmission, parseQuizServerId, quizToApi, taskToApi, toQuizDomainId } from './mappers'
import type { ApiContentItem, ApiFile, ApiModule, ApiQuiz, ApiSubmission } from './types'

/**
 * Real calls against the Go backend (cmd/server/main.go). A backend "module" is one week:
 *   GET    /modules                                                     the signed-in user's modules
 *   GET    /modules/:moduleId/content-items                             flat list of files and assignments
 *   GET    /modules/:moduleId/content-items/:assignmentId/submissions/me    (404 = nothing handed in)
 *   POST   /files                                                       multipart, field "file"
 *   POST   /modules/:moduleId/content-items/:assignmentId/submissions   { text_body, file_ids: number[] }
 *   POST   /modules                                                     { title, description, opens_at?, closes_at? } (new module)
 *   PATCH  /modules/:id                                                 { title?, description?, opens_at?, closes_at? }
 *          (the week dates are the proposed fields: the server does not store them yet, see datesNotKept)
 *   POST   /modules/:moduleId/content-items                             new task / file material / link
 *   PATCH  /content-items/:id                                           edit one (title, description, due_at, file_id, url)
 *   DELETE /content-items/:id
 *   DELETE /modules/:id                                                 (admin or the module's creator)
 */

const isAssignment = (i: ApiContentItem) => i.type === 'assignment'

/** The student's own work on one task; 404 simply means nothing handed in yet. */
async function mySubmission(moduleId: string, assignmentId: string): Promise<ApiSubmission | undefined> {
  try {
    return await authedRequest<ApiSubmission>(`/modules/${moduleId}/content-items/${assignmentId}/submissions/me`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined
    throw e
  }
}

interface EnrollmentDto {
  user_id: number | string
}

/**
 * Who teaches each week. The backend has no "lecturer of a module" field: a lecturer is ENROLLED in the module
 * (POST /modules/:id/enrollments { user_id }), so the lecturers of a week are the enrolled users who have the lecturer role.
 * Best effort: when the lists cannot be read (a role without access, an older server) no week has a lecturer.
 */
async function lecturersByModule(moduleIds: number[]): Promise<Record<string, number[]>> {
  try {
    const users = await authedRequest<UserDto[] | null>('/users?search=')
    const lecturers = new Set((users ?? []).map(mapUser).filter((u) => u.roles.includes('lecturer')).map((u) => u.id))
    if (lecturers.size === 0) return {}
    const lists = await Promise.all(
      moduleIds.map((id) => authedRequest<EnrollmentDto[] | null>(`/modules/${id}/enrollments`).then((r) => r ?? [], () => [] as EnrollmentDto[])),
    )
    const out: Record<string, number[]> = {}
    moduleIds.forEach((id, i) => {
      const found = lists[i].map((e) => Number(e.user_id)).filter((u) => lecturers.has(u))
      if (found.length) out[String(id)] = found
    })
    return out
  } catch {
    return {}
  }
}

/** `withSubmissions`: students also get their own hand-ins (one request per task; staff have none). */
export async function fetchModules(withSubmissions: boolean): Promise<CourseModule[]> {
  const modules = await authedRequest<ApiModule[] | null>('/modules')
  const list = modules ?? []
  const [items, quizzes] = await Promise.all([
    Promise.all(
      list.map((m) => authedRequest<ApiContentItem[] | null>(`/modules/${m.id}/content-items`).then((r) => r ?? [])),
    ),
    Promise.all(
      list.map((m) =>
        authedRequest<ApiQuiz[] | null>(`/modules/${m.id}/quizzes`)
          .then((r) => r ?? [])
          .catch((e) => {
            // 404: a server without quizzes. 403: the server only lists a module's quizzes to its students, its creator and
            // admins (a mentor, or a lecturer who is not the creator, is refused): no quizzes for them, not a broken course.
            if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return []
            throw e
          }),
      ),
    ),
  ])
  const itemsByModule: Record<string, ApiContentItem[]> = {}
  const quizzesByModule: Record<string, ApiQuiz[]> = {}
  list.forEach((m, i) => {
    itemsByModule[String(m.id)] = items[i]
    quizzesByModule[String(m.id)] = quizzes[i]
  })

  const mine: Record<string, ApiSubmission | undefined> = {}
  if (withSubmissions) {
    const wanted = list.flatMap((m) => itemsByModule[String(m.id)].filter(isAssignment).map((a) => [String(m.id), String(a.id)] as const))
    const found = await Promise.all(wanted.map(([mid, aid]) => mySubmission(mid, aid)))
    wanted.forEach(([, aid], i) => {
      mine[aid] = found[i]
    })
  }
  // staff also learn which lecturers teach each week (students have no use for it)
  const teaching = withSubmissions ? {} : await lecturersByModule(list.map((m) => Number(m.id)))
  const withLecturer = list.map((m) => (teaching[String(m.id)] !== undefined ? { ...m, lecturer_ids: teaching[String(m.id)] } : m))
  // only admins are sent hidden items (the backend filters them for everyone else); students never get them
  return mapModules(withLecturer, itemsByModule, mine, { includeHidden: !withSubmissions }, quizzesByModule)
}

/** Uploads one file and returns its id as the NUMBER the backend expects in `file_ids` / `file_id`. */
async function upload(file: File): Promise<number> {
  const form = new FormData()
  form.append('file', file)
  const uploaded = await authedRequest<ApiFile>('/files', { method: 'POST', body: form })
  return Number(uploaded.id)
}

export interface SubmitPayload {
  textBody: string
  /** New files to upload. */
  files: File[]
  /** Files of the current version handed in again (already uploaded: sent by id, not uploaded twice). */
  keep?: SubmissionFile[]
}

export async function submitWork(moduleId: string, assignmentId: string, payload: SubmitPayload): Promise<Submission> {
  // files first: the submission refers to them by id
  const kept = (payload.keep ?? []).filter((f) => f.id !== undefined)
  const fileIds: number[] = kept.map((f) => Number(f.id))
  for (const file of payload.files) fileIds.push(await upload(file))

  const res = await authedRequest<ApiSubmission>(`/modules/${moduleId}/content-items/${assignmentId}/submissions`, {
    method: 'POST',
    body: { text_body: payload.textBody, file_ids: fileIds },
  })
  const mapped = mapSubmission(res)
  // the response may leave out the files; show the ones just sent
  return mapped.files ? mapped : { ...mapped, files: [...kept, ...payload.files.map((f) => ({ name: f.name, sizeBytes: f.size }))] }
}

interface ModuleFields {
  title?: string
  description?: string
  opensAt?: string
  closesAt?: string
}

/** Only the fields the form changed; the week dates go as `opens_at` / `closes_at` (null clears one). */
function moduleBody(patch: ModuleFields) {
  return {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.opensAt !== undefined ? { opens_at: patch.opensAt || null } : {}),
    ...(patch.closesAt !== undefined ? { closes_at: patch.closesAt || null } : {}),
  }
}

/** Module title, description and week dates. Whether the server kept the dates is checked by the caller (datesNotKept). */
export async function saveModule(id: string, patch: ModuleFields): Promise<CourseModule[]> {
  await authedRequest(`/modules/${id}`, { method: 'PATCH', body: moduleBody(patch) })
  return fetchModules(false)
}

/** Creates a module and returns its id, without reloading the course (for importing many at once). */
export async function postModule(patch: ModuleFields & { title: string }): Promise<string> {
  const created = await authedRequest<ApiModule>('/modules', { method: 'POST', body: moduleBody(patch) })
  return String(created.id)
}

/** A new module (the backend records who created it). */
export async function createModule(patch: ModuleFields & { title: string }): Promise<{ id: string; modules: CourseModule[] }> {
  return { id: await postModule(patch), modules: await fetchModules(false) }
}

export class NotSupportedError extends ApiError {
  constructor(message: string) {
    super(501, 'not_supported', message)
  }
}

async function saveTask(t: AssignmentItem): Promise<void> {
  const body = taskToApi(t)
  if (!isServerId(t.id)) {
    await authedRequest(`/modules/${t.moduleId}/content-items`, { method: 'POST', body })
    return
  }
  await authedRequest(`/content-items/${t.id}`, { method: 'PATCH', body: { title: body.title, description: body.description, due_at: body.due_at } })
}

async function saveLink(r: ResourceItem): Promise<void> {
  const body = { title: r.title, description: joinDescription(r.description, undefined), url: r.url ?? '' }
  if (!isServerId(r.id)) {
    await authedRequest(`/modules/${r.moduleId}/content-items`, { method: 'POST', body: { type: 'link', ...body, is_visible: true } })
    return
  }
  await authedRequest(`/content-items/${r.id}`, { method: 'PATCH', body })
}

async function saveMaterial(r: ResourceItem): Promise<void> {
  if (r.kind === 'link') return saveLink(r)
  const description = joinDescription(r.description, undefined)
  const fileId = r.upload ? await upload(r.upload) : r.fileId ? Number(r.fileId) : undefined
  if (!isServerId(r.id)) {
    if (fileId === undefined) throw new ApiError(400, 'bad_request', 'Choose a file to upload.')
    await authedRequest(`/modules/${r.moduleId}/content-items`, {
      method: 'POST',
      body: { type: 'file', title: r.title, description, file_id: fileId, is_visible: true },
    })
    return
  }
  await authedRequest(`/content-items/${r.id}`, {
    method: 'PATCH',
    body: { title: r.title, description, ...(fileId !== undefined ? { file_id: fileId } : {}) },
  })
}

/** A quiz is created (app-made id) or edited (numeric server id) under its own module, with all its questions. */
async function saveQuiz(q: QuizItem) {
  const serverId = parseQuizServerId(q.id)
  const body = quizToApi(q)
  if (serverId == null) {
    await authedRequest(`/modules/${q.moduleId}/quizzes`, { method: 'POST', body })
    return
  }
  await authedRequest(`/quizzes/${serverId}`, {
    method: 'PATCH',
    body: {
      ...body,
      clear_due_at: !q.dueAt,
      replace_questions: true,
    },
  })
}

/** Creates (app-made id) or edits (numeric server id) one item, always under its own module. */
export async function saveItem(item: ContentItem): Promise<CourseModule[]> {
  await writeItem(item)
  return fetchModules(false)
}

/** Saves one item without reloading the course (for importing many at once). */
export async function writeItem(item: ContentItem): Promise<void> {
  if (!isServerId(item.moduleId)) throw new ApiError(400, 'bad_request', 'This module is not saved on the server.')
  if (item.type === 'assignment') await saveTask(item)
  else if (item.type === 'resource') await saveMaterial(item)
  else await saveQuiz(item)
}

export async function generateAiQuiz(input: {
  moduleId: string
  contentItemId: string
  title?: string
  dueAt?: string
}): Promise<{ quizId: string; modules: CourseModule[] }> {
  if (!isServerId(input.moduleId) || !isServerId(input.contentItemId)) {
    throw new ApiError(400, 'bad_request', 'Module and material must be saved on the server.')
  }
  const created = await authedRequest<ApiQuiz>(`/modules/${input.moduleId}/quizzes/ai`, {
    method: 'POST',
    body: {
      content_item_id: Number(input.contentItemId),
      ...(input.title ? { title: input.title } : {}),
      ...(input.dueAt ? { due_at: input.dueAt } : {}),
    },
  })
  return { quizId: toQuizDomainId(created.id), modules: await fetchModules(false) }
}

export async function submitQuizAttempt(quizId: string, answers: number[]): Promise<CourseModule[]> {
  const serverId = parseQuizServerId(quizId)
  if (serverId == null) throw new ApiError(400, 'bad_request', 'This quiz is not saved on the server.')
  await authedRequest<ApiQuiz>(`/quizzes/${serverId}/attempts`, {
    method: 'POST',
    body: { answers },
  })
  return fetchModules(true)
}

/**
 * Adds `lecturerId` to the lecturers of the week (module), or takes them off it (`assigned: false`). A week can have
 * several lecturers and a lecturer several weeks: each is an enrollment (POST /modules/:id/enrollments { user_id },
 * DELETE /modules/:id/enrollments/:userId).
 */
export async function assignLecturer(moduleId: string, lecturerId: number, assigned = true): Promise<CourseModule[]> {
  try {
    if (assigned) await authedRequest(`/modules/${moduleId}/enrollments`, { method: 'POST', body: { user_id: lecturerId } })
    else await authedRequest(`/modules/${moduleId}/enrollments/${lecturerId}`, { method: 'DELETE' })
  } catch (e) {
    // already enrolled / already not enrolled: nothing to change
    if (!(e instanceof ApiError && e.status === (assigned ? 409 : 404))) throw e
  }
  return fetchModules(false)
}

/** Soft delete on the server: its items go with it, students' handed-in work is kept. */
export async function deleteModule(id: string): Promise<CourseModule[]> {
  await authedRequest<void>(`/modules/${id}`, { method: 'DELETE' })
  return fetchModules(false)
}

export async function deleteItem(id: string): Promise<CourseModule[]> {
  const quizId = parseQuizServerId(id)
  if (quizId != null) await authedRequest<void>(`/quizzes/${quizId}`, { method: 'DELETE' })
  else await authedRequest<void>(`/content-items/${id}`, { method: 'DELETE' })
  return fetchModules(false)
}
