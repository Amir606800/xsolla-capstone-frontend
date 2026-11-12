import { listUsers, setPassword } from '../mocks/directory'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * A signed-in person (any role) sets a new password for their OWN account, without the current one and without an
 * e-mail confirmation (there is no e-mail sending yet).
 * - An ADMIN uses the route the server already has, with their own id:
 *     PUT /users/:id/password  { password }   -> 204   (admin only; 400 when the rules are broken)
 *   The server then ends all of that admin's sessions, so the caller signs the admin out afterwards.
 * - Everyone else uses the proposed route, see BACKEND_REQUIREMENTS.md:
 *     PUT /users/me/password   { password }   -> 204   (422 when the rules are broken)
 *   The server answers 403 to a non-admin on its only password route (and 400 "invalid user ID" to "me"): that is
 *   reported as "not supported yet".
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export const NOT_SUPPORTED = 'The server cannot change your own password yet. Ask an admin to reset it for you.'

const notSupported = (e: ApiError) =>
  e.status === 403 || e.status === 404 || e.status === 405 || e.status === 501 || (e.status === 400 && /invalid user id/i.test(e.message))

export async function changeOwnPassword(userId: number, next: string, { admin = false }: { admin?: boolean } = {}): Promise<void> {
  if (hasBackend()) {
    if (admin) {
      await authedRequest<void>(`/users/${userId}/password`, { method: 'PUT', body: { password: next } })
      return
    }
    try {
      await authedRequest<void>('/users/me/password', { method: 'PUT', body: { password: next } })
    } catch (e) {
      if (e instanceof ApiError && notSupported(e)) throw new ApiError(501, 'not_supported', NOT_SUPPORTED)
      throw e
    }
    return
  }
  await wait()
  // the demo admin is not in the directory: nothing to keep
  if (listUsers().some((u) => u.id === userId)) setPassword(userId, next)
}
