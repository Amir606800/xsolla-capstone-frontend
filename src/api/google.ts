import { mockGoogleCalendar, mockGoogleConnect, mockGoogleStatus } from '../mocks/google'
import type { GoogleStatus } from '../types/google'
import * as http from './google.http'
import type { GoogleEventsResult } from './google.http'
import { mapGoogleEvent } from './mappers'
import { hasBackend } from './http'

/**
 * The Google Calendar connection: the real backend when VITE_API_URL is set (./google.http), a local
 * stand-in otherwise. Disconnecting is not offered: the server has no route for it yet.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  if (hasBackend()) return http.fetchStatus()
  await wait()
  return mockGoogleStatus()
}

/**
 * Starts the connection. With a backend the browser leaves for Google (and comes back to /settings), so
 * this resolves to 'redirecting'; offline it finishes at once and resolves to the new status.
 */
export async function connectGoogle(user: { name: string; email: string }): Promise<'redirecting' | GoogleStatus> {
  if (hasBackend()) {
    const url = await http.connectUrl()
    window.location.assign(url)
    return 'redirecting'
  }
  await wait()
  return mockGoogleConnect(user)
}

/** The person's own Google Calendar around today (about a year), read-only. Only asked for when Google is connected. */
export async function fetchGoogleCalendar(now: Date = new Date()): Promise<GoogleEventsResult> {
  const DAY = 86_400_000
  const from = new Date(now.getTime() - 120 * DAY)
  const to = new Date(now.getTime() + 240 * DAY)
  if (hasBackend()) return http.fetchCalendarEvents(from, to)
  await wait()
  const rows = mockGoogleCalendar(now)
  if (rows === 'reconnect') return { state: 'reconnect' }
  if (rows === 'disconnected') return { state: 'ok', events: [] }
  return { state: 'ok', events: rows.map(mapGoogleEvent) }
}
