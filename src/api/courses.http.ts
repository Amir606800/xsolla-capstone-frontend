import type { AssignmentItem, ContentItem, CourseModule, ResourceItem, Submission } from '../types/course'
import { authedRequest } from './authed'
import { ApiError } from './http'
import { isServerId, joinDescription, mapModules, mapSubmission, taskToApi } from './mappers'
import type { ApiContentItem, ApiFile, ApiModule, ApiSubmission } from './types'

/**
 * Real calls against the Go backend (cmd/server/main.go). A backend "module" is one week:
 *   GET    /modules                                                     the signed-in user's modules
 *   GET    /modules/:moduleId/content-items                             flat list of files and assignments
 *   GET    /modules/:moduleId/content-items/:assignmentId/submissions/me    (404 = nothing handed in)
 *   POST   /files                                                       multipart, field "file"
 *   POST   /modules/:moduleId/content-items/:assignmentId/submissions   { text_body, file_ids: number[] }
 *   POST   /modules                                                     { title, description } (new module)
 *   PATCH  /modules/:id                                                 { title, description }
 *   POST   /modules/:moduleId/content-items                             new task / file material
 *   PATCH  /content-items/:id                                           edit one
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

/** `withSubmissions`: students also get their own hand-ins (one request per task; staff have none). */
export async function fetchModules(withSubmissions: boolean): Promise<CourseModule[]> {
  const modules = await authedRequest<ApiModule[] | null>('/modules')
  const list = modules ?? []
  const items = await Promise.all(
    list.map((m) => authedRequest<ApiContentItem[] | null>(`/modules/${m.id}/content-items`).then((r) => r ?? [])),
  )
  const itemsByModule: Record<string, ApiContentItem[]> = {}
  list.forEach((m, i) => {
    itemsByModule[String(m.id)] = items[i]
  })

  const mine: Record<string, ApiSubmission | undefined> = {}
  if (withSubmissions) {
    const wanted = list.flatMap((m) => itemsByModule[String(m.id)].filter(isAssignment).map((a) => [String(m.id), String(a.id)] as const))
    const found = await Promise.all(wanted.map(([mid, aid]) => mySubmission(mid, aid)))
    wanted.forEach(([, aid], i) => {
      mine[aid] = found[i]
    })
  }
  // only admins are sent hidden items (the backend filters them for everyone else); students never get them
  return mapModules(list, itemsByModule, mine, { includeHidden: !withSubmissions })
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
  files: File[]
}

export async function submitWork(moduleId: string, assignmentId: string, payload: SubmitPayload): Promise<Submission> {
  // files first: the submission refers to them by id
  const fileIds: number[] = []
  for (const file of payload.files) fileIds.push(await upload(file))

  const res = await authedRequest<ApiSubmission>(`/modules/${moduleId}/content-items/${assignmentId}/submissions`, {
    method: 'POST',
    body: { text_body: payload.textBody, file_ids: fileIds },
  })
  const mapped = mapSubmission(res)
  // the response may leave out the files; show the ones just sent
  return mapped.files ? mapped : { ...mapped, files: payload.files.map((f) => ({ name: f.name, sizeBytes: f.size })) }
}

/** Module title and description. The backend has no week dates yet, so those are not sent. */
export async function saveModule(id: string, patch: { title?: string; description?: string }): Promise<CourseModule[]> {
  await authedRequest(`/modules/${id}`, {
    method: 'PATCH',
    body: { ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.description !== undefined ? { description: patch.description } : {}) },
  })
  return fetchModules(false)
}

/** A new module (the backend records who created it). It has no week dates yet, so those are not sent. */
export async function createModule(patch: {
  title: string
  description?: string
  opensAt?: string
  closesAt?: string
}): Promise<{ id: string; modules: CourseModule[] }> {
  const created = await authedRequest<ApiModule>('/modules', {
    method: 'POST',
    body: { title: patch.title, ...(patch.description ? { description: patch.description } : {}) },
  })
  return { id: String(created.id), modules: await fetchModules(false) }
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
  // PATCH /content-items/:id takes no due_at (dto.UpdateContentItemRequest), so a changed deadline is not saved yet
  await authedRequest(`/content-items/${t.id}`, { method: 'PATCH', body: { title: body.title, description: body.description } })
}

async function saveMaterial(r: ResourceItem): Promise<void> {
  if (r.kind === 'link') throw new NotSupportedError('Links cannot be saved by the backend yet. Upload a file instead.')
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

/**
 * Creates (app-made id) or edits (numeric server id) one item, always under its own module.
 * Quizzes and link materials have no place in the backend yet.
 */
export async function saveItem(item: ContentItem): Promise<CourseModule[]> {
  if (!isServerId(item.moduleId)) throw new ApiError(400, 'bad_request', 'This module is not saved on the server.')
  if (item.type === 'assignment') await saveTask(item)
  else if (item.type === 'resource') await saveMaterial(item)
  else throw new NotSupportedError('Quizzes cannot be saved by the backend yet.')
  return fetchModules(false)
}

/**
 * Makes `lecturerId` the lecturer of the week (module). The backend has no field for this yet; the call
 * uses the proposed one (PATCH /modules/:id { lecturer_id }) and checks the answer, because a server
 * that does not know the field would accept the request and change nothing.
 */
export async function assignLecturer(moduleId: string, lecturerId: number): Promise<CourseModule[]> {
  await authedRequest(`/modules/${moduleId}`, { method: 'PATCH', body: { lecturer_id: lecturerId } })
  const modules = await fetchModules(false)
  if (modules.find((m) => m.id === moduleId)?.createdBy !== lecturerId) {
    throw new NotSupportedError('The server cannot change the lecturer of a week yet.')
  }
  return modules
}

/** Soft delete on the server: its items go with it, students' handed-in work is kept. */
export async function deleteModule(id: string): Promise<CourseModule[]> {
  await authedRequest<void>(`/modules/${id}`, { method: 'DELETE' })
  return fetchModules(false)
}

export async function deleteItem(id: string): Promise<CourseModule[]> {
  await authedRequest<void>(`/content-items/${id}`, { method: 'DELETE' })
  return fetchModules(false)
}
