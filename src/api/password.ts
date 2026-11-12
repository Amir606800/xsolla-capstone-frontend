import { listUsers, passwordMatches, setPassword } from '../mocks/directory'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * A signed-in person changes their OWN password (any role). Proposed route, see BACKEND_REQUIREMENTS.md:
 *   PUT /users/me/password  { current_password, password }   -> 204
 *   422 when the current password is wrong or the new one breaks the rules.
 * The server's only password route today is the admin's `PUT /users/:id/password`, which answers 403 to everyone
 * else (and 400 "invalid user ID" to an admin asking for "me"): that is reported as "not supported yet", not as a
 * wrong password. Offline, the demo store checks the old password (any password works until one was set).
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export const WRONG_CURRENT = 'Your current password is not right.'
export const NOT_SUPPORTED = 'The server cannot change your own password yet. Ask an admin to reset it for you.'

const notSupported = (e: ApiError) =>
  e.status === 403 || e.status === 404 || e.status === 405 || e.status === 501 || (e.status === 400 && /invalid user id/i.test(e.message))

export async function changeOwnPassword(userId: number, current: string, next: string): Promise<void> {
  if (hasBackend()) {
    try {
      await authedRequest<void>('/users/me/password', { method: 'PUT', body: { current_password: current, password: next } })
    } catch (e) {
      if (e instanceof ApiError) {
        if (notSupported(e)) throw new ApiError(501, 'not_supported', NOT_SUPPORTED)
        if (e.status === 422 || e.status === 401) throw new ApiError(422, 'validation_failed', e.message || WRONG_CURRENT)
      }
      throw e
    }
    return
  }
  await wait()
  const known = listUsers().some((u) => u.id === userId)
  if (!known) return // the demo admin is not in the directory: nothing to check or keep
  if (!passwordMatches(userId, current)) throw new ApiError(422, 'validation_failed', WRONG_CURRENT)
  setPassword(userId, next)
}
