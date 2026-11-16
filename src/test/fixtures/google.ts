import type { ApiGoogleCalendarEvent } from '../api/types'
import type { GoogleAccount, GoogleStatus } from '../types/google'

/**
 * Offline stand-in for the Google connection, kept in this browser. It only exists so the demo and the
 * tests can show every state; with a backend the server holds the real tokens.
 */
const KEY = 'google_mock'

type Stored = { connection: 'connected' | 'disconnected' | 'reconnect'; account?: GoogleAccount }

function read(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Stored> | null
    if (raw && (raw.connection === 'connected' || raw.connection === 'reconnect' || raw.connection === 'disconnected')) {
      return { connection: raw.connection, ...(raw.account ? { account: raw.account } : {}) }
    }
  } catch {
    // unreadable: treat as never connected
  }
  return { connection: 'disconnected' }
}

function write(value: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // storage unavailable: the demo just forgets
  }
}

export function mockGoogleStatus(): GoogleStatus {
  const s = read()
  // a revoked connection still remembers whose account it was
  return s.connection === 'disconnected' ? { connection: 'disconnected' } : { connection: s.connection, ...(s.account ? { account: s.account } : {}) }
}

/** The "Connect" flow, done at once: a Google account named after the person. */
export function mockGoogleConnect(user: { name: string; email: string }): GoogleStatus {
  const local = user.email.split('@')[0] || 'user'
  write({ connection: 'connected', account: { email: `${local}@gmail.com`, name: user.name } })
  return mockGoogleStatus()
}

/** "Disconnect": the demo forgets the account. */
export function mockGoogleDisconnect(): GoogleStatus {
  write({ connection: 'disconnected' })
  return mockGoogleStatus()
}

/** Events saved now can reach the person's Google Calendar. */
export const mockGoogleIsReady = () => read().connection === 'connected'

/**
 * A few events of the demo person's own Google Calendar (what GET /google/calendar/events would return), around `now`:
 * a timed one with a Meet link, an all-day one, and one with no title. Only when connected; a revoked connection
 * answers "reconnect" like the real server's 401.
 */
export function mockGoogleCalendar(now: Date = new Date()): ApiGoogleCalendarEvent[] | 'reconnect' | 'disconnected' {
  const s = read()
  if (s.connection === 'reconnect') return 'reconnect'
  if (s.connection !== 'connected') return 'disconnected'
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const at = (offset: number, hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour).toISOString()
  return [
    {
      id: 'demo-dentist',
      title: 'Dentist appointment',
      description: 'A personal event',
      location: 'Smile Clinic',
      starts_at: at(1, 10),
      ends_at: at(1, 11),
      all_day: false,
      html_link: 'https://www.google.com/calendar/event?eid=demo-dentist',
    },
    { id: 'demo-call', title: 'Call with family', starts_at: at(2, 19), ends_at: at(2, 20), all_day: false, meeting_url: 'https://meet.google.com/abc-defg-hij' },
    { id: 'demo-birthday', title: 'Friend\u2019s birthday', starts_at: day(3), ends_at: day(3), all_day: true },
    { id: 'demo-untitled', title: '', starts_at: at(4, 9), ends_at: at(4, 10), all_day: false },
  ]
}
