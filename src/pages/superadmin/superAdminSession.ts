/**
 * The demo sign-in of the Super Admin: front-end only, no server. The one account is "admin" / "admin" (a demo, so the
 * password is not a secret). Being signed in is remembered for this browser tab only; where storage is not available
 * it is kept in memory, until the page is reloaded.
 */
export const DEMO_USERNAME = 'admin'
export const DEMO_PASSWORD = 'admin'

const KEY = 'super_admin_signed_in'
let inMemory = false

export function isSuperAdminSignedIn(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1' || inMemory
  } catch {
    return inMemory
  }
}

/** Signs in with the demo account; false for any other username or password. */
export function signInSuperAdmin(username: string, password: string): boolean {
  if (username.trim() !== DEMO_USERNAME || password !== DEMO_PASSWORD) return false
  inMemory = true
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // storage unavailable: the memory flag is enough
  }
  return true
}

export function signOutSuperAdmin(): void {
  inMemory = false
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // storage unavailable
  }
}
