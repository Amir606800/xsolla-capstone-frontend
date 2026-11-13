import type { CalendarEvent } from '../types/calendar'
import type { GoogleAccount, GoogleStatus } from '../types/google'
import { authedRequest, refresh } from './authed'
import { ApiError, apiBaseUrl } from './http'
import { mapGoogleEvent } from './mappers'
import { getTokens } from './session'
import type { ApiGoogleCalendarEvent } from './types'

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

/** What asking for the person's own Google events can answer besides the events themselves. */
export type GoogleEventsResult = { state: 'ok'; events: CalendarEvent[] } | { state: 'reconnect' } | { state: 'unsupported' }

/**
 * GET /google/calendar/events?from=&to= : the signed-in person's primary Google Calendar, read-only (at most 366 days).
 * 401 = the Google token is no longer good (reconnect); 404/405 = a server without the route (or not connected: the
 * page does not ask then). Anything else (502 Google down, 500, no network) throws, and the calendar shows a quiet retry.
 */
export async function fetchCalendarEvents(from: Date, to: Date): Promise<GoogleEventsResult> {
  try {
    const rows = await authedRequest<ApiGoogleCalendarEvent[] | null>(
      `/google/calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    )
    return { state: 'ok', events: (rows ?? []).map(mapGoogleEvent) }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) return { state: 'reconnect' }
      if (e.status === 404 || e.status === 405 || e.status === 501) return { state: 'unsupported' }
    }
    throw e
  }
}

/**
 * POST /auth/google/logout (signed in): the server forgets the person's Google credentials (204). The app is still
 * listed in their Google account until they remove it there, which is the person's own step.
 */
export async function disconnect(): Promise<void> {
  try {
    await authedRequest<void>('/auth/google/logout', { method: 'POST' })
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)) {
      throw new Error('The school’s server cannot disconnect Google yet. Remove access in your Google account instead.', { cause: e })
    }
    throw e
  }
}
