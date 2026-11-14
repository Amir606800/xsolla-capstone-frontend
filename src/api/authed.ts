import { ApiError, apiRequest } from './http'
import { clearTokens, getTokens, saveTokens } from './session'

/**
 * Requests that need the signed-in user (API_CONTRACT.md "Frontend Auth Contract"):
 *  - sends `Authorization: Bearer <access_token>`
 *  - on 401 tries POST /auth/refresh once and repeats the request with the new token
 *  - if that fails too: clears the session and sends the user to /login (/admin/login from the admin section)
 */

/** POST /auth/refresh -> new token pair, saved. Throws (401) when the refresh token is invalid or expired. */
export async function refresh(): Promise<string> {
  const tokens = getTokens()
  if (!tokens) throw new ApiError(401, 'unauthorized', 'Please sign in again')
  const res = await apiRequest<{ access_token: string; refresh_token: string }>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: tokens.refreshToken },
    token: tokens.accessToken,
  })
  saveTokens({ accessToken: res.access_token, refreshToken: res.refresh_token })
  return res.access_token
}

// parallel requests that all get a 401 share one refresh (a refresh token may be single-use)
let refreshing: Promise<string> | null = null
function refreshOnce(): Promise<string> {
  refreshing ??= refresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

function endSession() {
  clearTokens()
  try {
    localStorage.removeItem('auth_user')
  } catch {
    // storage unavailable
  }
  // the admin section has its own sign-in page
  const login = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login'
  if (window.location.pathname !== login) window.location.assign(login)
}

type Options = NonNullable<Parameters<typeof apiRequest>[1]>

export async function authedRequest<T>(path: string, options: Omit<Options, 'token'> = {}): Promise<T> {
  const tokens = getTokens()
  if (!tokens) {
    endSession()
    throw new ApiError(401, 'unauthorized', 'Please sign in again')
  }
  try {
    return await apiRequest<T>(path, { ...options, token: tokens.accessToken })
  } catch (e) {
    // a 401 that says "wrong credentials" (e.g. a wrong current password) is not about the session: no refresh, no retry
    if (!(e instanceof ApiError) || e.status !== 401 || e.code === 'invalid_credentials') throw e
    let token: string
    try {
      token = await refreshOnce()
    } catch {
      endSession()
      throw e
    }
    return apiRequest<T>(path, { ...options, token })
  }
}
