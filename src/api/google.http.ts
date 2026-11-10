import type { GoogleAccount, GoogleStatus } from '../types/google'
import { authedRequest, refresh } from './authed'
import { ApiError, apiBaseUrl } from './http'
import { getTokens } from './session'

/**
 * Real Google calls (internal/handlers/auth.go):
 *   GET /auth/google/login?access_token=   302 to Google's consent screen (a page navigation, not an XHR)
 *   GET /auth/google/callback              Google's way back; the server redirects to the frontend with ?google=connected|error
 *   GET /auth/google/me                    the connected account's profile
 */

interface ApiGoogleProfile {
  email?: string
  name?: string
  picture?: string
}

function accountFrom(p: ApiGoogleProfile): GoogleAccount {
  return { email: p.email ?? '', name: p.name || p.email || 'Google account', ...(p.picture ? { picture: p.picture } : {}) }
}

/** Never throws for the answers the server uses to say "not connected" or "not working": those are states. */
export async function fetchStatus(): Promise<GoogleStatus> {
  try {
    const profile = await authedRequest<ApiGoogleProfile>('/auth/google/me')
    return { connection: 'connected', account: accountFrom(profile) }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    if (e.status === 404 && e.code === 'google_not_connected') return { connection: 'disconnected' }
    if (e.status === 401) return { connection: 'reconnect' }
    // an older server without the Google routes
    if (e.status === 404 || e.status === 405 || e.status === 501) return { connection: 'unsupported' }
    // 502 (Google down), 500, no network: nothing is known about the connection
    return { connection: 'unavailable' }
  }
}

/**
 * Where the "Connect" button sends the browser. The server reads the login from `?access_token=` because a
 * page navigation cannot carry a header. The token is renewed first so it is fresh for the trip.
 */
export async function connectUrl(): Promise<string> {
  try {
    await refresh()
  } catch {
    // use the token we have; the server will say if it is no good
  }
  const tokens = getTokens()
  if (!tokens) throw new ApiError(401, 'unauthorized', 'Please sign in again')
  return `${apiBaseUrl()}/auth/google/login?access_token=${encodeURIComponent(tokens.accessToken)}`
}
