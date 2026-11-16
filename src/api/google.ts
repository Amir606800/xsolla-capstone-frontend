import type { GoogleStatus } from '../types/google'
import * as http from './google.http'
import type { GoogleEventsResult } from './google.http'

/**
 * The Google Calendar connection (./google.http). Two ways out: disconnect (the server forgets its copy) and revoke
 * (Google's permission is withdrawn too).
 */
export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  return http.fetchStatus()
}

/** Takes the Google connection away (the server forgets the token). Resolves with the new status. */
export async function disconnectGoogle(): Promise<GoogleStatus> {
  await http.disconnect()
  return { connection: 'disconnected' }
}

/** Disconnects and also takes the school app's permission back at Google (the server revokes the grant, then forgets it). */
export async function revokeGoogle(): Promise<GoogleStatus> {
  await http.revoke()
  return { connection: 'disconnected' }
}

/** Starts the connection: the browser leaves for Google (and comes back to /settings), so this resolves to 'redirecting'. */
export async function connectGoogle(user: { name: string; email: string }): Promise<'redirecting' | GoogleStatus> {
  void user
  window.location.assign(await http.connectUrl())
  return 'redirecting'
}

/** The person's own Google Calendar around today (about a year), read-only. Only asked for when Google is connected. */
export async function fetchGoogleCalendar(now: Date = new Date()): Promise<GoogleEventsResult> {
  const DAY = 86_400_000
  return http.fetchCalendarEvents(new Date(now.getTime() - 120 * DAY), new Date(now.getTime() + 240 * DAY))
}
