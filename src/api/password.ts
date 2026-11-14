import { listUsers, passwordMatches, setPassword } from '../mocks/directory'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * A signed-in person (any role) changes the password of their OWN account. The server is told the current password
 * too, so a stolen session cannot take the account over:
 *     POST /auth/password-reset   { old_password, new_password }   -> 204
 * The person is known from the bearer token. The answers:
 *     401 invalid_credentials   the current password is wrong (authedRequest does not treat it as an expired session)
 *     400 bad_request           the new password breaks a rule (the message says which one, e.g. "Add a number")
 * The person's sessions stay open afterwards.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export const NOT_SUPPORTED = 'The server cannot change your own password yet. Ask an admin to reset it for you.'
export const WRONG_CURRENT = 'Your current password is not right.'

const notSupported = (e: ApiError) => e.status === 404 || e.status === 405 || e.status === 501

export async function changeOwnPassword(userId: number, current: string, next: string): Promise<void> {
  if (hasBackend()) {
    try {
      await authedRequest<void>('/auth/password-reset', { method: 'POST', body: { old_password: current, new_password: next } })
    } catch (e) {
      if (e instanceof ApiError && notSupported(e)) throw new ApiError(501, 'not_supported', NOT_SUPPORTED)
      if (e instanceof ApiError && e.code === 'invalid_credentials') throw new ApiError(400, 'wrong_password', WRONG_CURRENT)
      throw e
    }
    return
  }
  await wait()
  // the demo admin is not in the directory: nothing to check or keep
  if (!listUsers().some((u) => u.id === userId)) return
  if (!passwordMatches(userId, current)) throw new ApiError(400, 'wrong_password', WRONG_CURRENT)
  setPassword(userId, next)
}
