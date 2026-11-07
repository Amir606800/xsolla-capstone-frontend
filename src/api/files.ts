import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * Downloading a file: course materials, and work students handed in.
 * Real backend: GET /files/:id/download. It needs the login token, so a plain <a href> cannot be
 * used; the file is fetched and then saved under its own name. The backend decides who may read it
 * (internal/service/file_service.go CanReadFile): the uploader, admins, students enrolled in the
 * module, the module's teacher, and for handed-in work the student and the module's teacher.
 * Offline demo: the files are not real, so a small text file explains that instead.
 */

export interface DownloadableFile {
  /** The backend's file id. */
  id?: string
  name: string
}

/** Saves a blob through a temporary link (works in every current browser). */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // give the browser a moment to start the download before the link is revoked
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const demoName = (name: string) => `${name.replace(/\.[^.]+$/, '')}-demo.txt`

export async function downloadFile(file: DownloadableFile): Promise<void> {
  if (!hasBackend()) {
    const text = `"${file.name}" is a demo file.\nOnce the app is connected to the backend, the real file downloads here.\n`
    saveBlob(new Blob([text], { type: 'text/plain' }), demoName(file.name))
    return
  }
  if (!file.id) throw new ApiError(404, 'not_found', 'This file is not on the server.')
  try {
    const blob = await authedRequest<Blob>(`/files/${file.id}/download`, { as: 'blob' })
    saveBlob(blob, file.name)
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) throw new ApiError(403, 'forbidden', 'You are not allowed to download this file.')
    if (e instanceof ApiError && e.status === 404) throw new ApiError(404, 'not_found', 'This file could not be found on the server.')
    throw e
  }
}
