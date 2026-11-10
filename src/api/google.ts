import { mockGoogleConnect, mockGoogleStatus } from '../mocks/google'
import type { GoogleStatus } from '../types/google'
import * as http from './google.http'
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
