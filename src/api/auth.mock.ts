import { DEMO_ACCOUNTS, DEMO_ADMIN } from '../mocks/accounts'
import { listUsers } from '../mocks/directory'
import type { User } from '../types/user'

/** Offline mock, used when no backend URL is configured (VITE_API_URL is empty). Same signatures as auth.http.ts. */

const MOCK_LATENCY_MS = 300
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// the demo accounts live with the other mocks; re-exported so existing imports keep working
export { DEMO_ACCOUNTS, DEMO_ADMIN } from '../mocks/accounts'

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Student'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export async function login(email: string, password: string): Promise<User> {
  await wait(MOCK_LATENCY_MS)
  if (!password) throw new Error('Invalid email or password')
  const key = email.trim().toLowerCase()
  if (key === DEMO_ADMIN.email) return DEMO_ADMIN
  // the admin's directory: accounts they added, and the roles they gave (lecturer until a date, ...)
  const known = listUsers().find((u) => u.email.toLowerCase() === key)
  if (known?.leftAt) throw new Error('This account is no longer active.')
  if (known) {
    const { leftAt: _left, ...user } = known
    void _left
    return user
  }
  const demo = DEMO_ACCOUNTS[key]
  if (demo) return demo
  return { id: 1, name: nameFromEmail(email), email, roles: ['student'] }
}

export async function signup(email: string, name: string, password: string): Promise<User> {
  await wait(MOCK_LATENCY_MS)
  if (!password) throw new Error('Invalid sign up data')
  return { id: 1, name, email, roles: ['student'] }
}

export async function logout(): Promise<void> {
  await wait(0)
}
