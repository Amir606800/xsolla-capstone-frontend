import type { User } from '../types/user'

/** Offline mock, used when no backend URL is configured (VITE_API_URL is empty). Same signatures as auth.http.ts. */

const MOCK_LATENCY_MS = 300
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Demo accounts for working offline; any password works. Any other e-mail signs in as a student.
 * - Rashad (900) mentors Team 3, Sam's team, and was also given the lecturer role, so what he
 *   changes is what Sam sees (same ids as in the team and 1:1 mocks).
 * - Aysel (901) is only a mentor (Team 4); Elvin (902) is only a lecturer, with no team.
 */
export const DEMO_ACCOUNTS: Record<string, User> = {
  'student@xsolla.school': { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] },
  'lecturer@xsolla.school': {
    id: 900,
    name: 'Rashad Aliyev',
    email: 'lecturer@xsolla.school',
    roles: ['mentor', 'lecturer'],
  },
  'mentor@xsolla.school': { id: 901, name: 'Aysel Mammadova', email: 'mentor@xsolla.school', roles: ['mentor'] },
  'teacher@xsolla.school': { id: 902, name: 'Elvin Huseynov', email: 'teacher@xsolla.school', roles: ['lecturer'] },
}

/** Offline admin account for the separate admin sign-in (/admin/login); any password works. */
export const DEMO_ADMIN: User = { id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Student'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export async function login(email: string, password: string): Promise<User> {
  await wait(MOCK_LATENCY_MS)
  if (!password) throw new Error('Invalid email or password')
  const key = email.trim().toLowerCase()
  if (key === DEMO_ADMIN.email) return DEMO_ADMIN
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
