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

/** Events saved now can reach the person's Google Calendar. */
export const mockGoogleIsReady = () => read().connection === 'connected'
