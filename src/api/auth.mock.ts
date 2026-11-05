import type { User } from '../types/user'

/**
 * MOCK implementation - no backend yet.
 * Keep the signatures; swap the bodies for `fetch` calls
 * (POST /auth/login, /auth/signup, /auth/logout) when the API is ready.
 */

const MOCK_LATENCY_MS = 300
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Student'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export async function login(email: string, password: string): Promise<User> {
  await wait(MOCK_LATENCY_MS)
  if (!password) throw new Error('Invalid email or password')
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
