import { authedRequest } from './authed'
import { ApiError } from './http'

/**
 * A signed-in person (any role) changes the password of their OWN account. The server is told the current password
 * too, so a stolen session cannot take the account over:
 *     POST /auth/password-reset   { old_password, new_password }   -> 204
 * The person is known from the bearer token. The answers:
 *     401 invalid_credentials   the current password is wrong (authedRequest does not treat it as an expired session)
 *     400 bad_request           the new password breaks a rule (the message says which one, e.g. "Add a number")
 * The person's sessions stay open afterwards.
 */
export const NOT_SUPPORTED = 'The server cannot change your own password yet. Ask an admin to reset it for you.'
export const WRONG_CURRENT = 'Your current password is not right.'

const notSupported = (e: ApiError) => e.status === 404 || e.status === 405 || e.status === 501

export async function changeOwnPassword(userId: number, current: string, next: string): Promise<void> {
  void userId // the server knows the person from the session
  try {
    await authedRequest<void>('/auth/password-reset', { method: 'POST', body: { old_password: current, new_password: next } })
  } catch (e) {
    if (e instanceof ApiError && notSupported(e)) throw new ApiError(501, 'not_supported', NOT_SUPPORTED)
    if (e instanceof ApiError && e.code === 'invalid_credentials') throw new ApiError(400, 'wrong_password', WRONG_CURRENT)
    throw e
  }
}
