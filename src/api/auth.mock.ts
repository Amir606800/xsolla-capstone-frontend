import type { User } from '../types/user'

/** Offline mock, used when no backend URL is configured (VITE_API_URL is empty). Same signatures as auth.http.ts. */

const MOCK_LATENCY_MS = 300
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Demo accounts for working offline; any password works. The lecturer is also the mentor of
 * Team 3 (same id as in the team and 1:1 mocks), so what they change is what the student sees.
 * Any other e-mail signs in as a student.
 */
export const DEMO_ACCOUNTS: Record<string, User> = {
  'student@xsolla.school': { id: 1, name: 'Sam Student', email: 'student@xsolla.school', role: 'student' },
  'lecturer@xsolla.school': { id: 900, name: 'Rashad Aliyev', email: 'lecturer@xsolla.school', role: 'teacher' },
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Student'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export async function login(email: string, password: string): Promise<User> {
  await wait(MOCK_LATENCY_MS)
  if (!password) throw new Error('Invalid email or password')
  const demo = DEMO_ACCOUNTS[email.trim().toLowerCase()]
  if (demo) return demo
  return { id: 1, name: nameFromEmail(email), email, role: 'student' }
}

export async function signup(email: string, name: string, password: string): Promise<User> {
  await wait(MOCK_LATENCY_MS)
  if (!password) throw new Error('Invalid sign up data')
  return { id: 1, name, email, role: 'student' }
}

export async function logout(): Promise<void> {
  await wait(0)
}
