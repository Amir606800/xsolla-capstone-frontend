/** The login tokens. Kept apart from the user profile (`auth_user`) that the UI reads. */

export interface Tokens {
  accessToken: string
  refreshToken: string
}

const KEY = 'auth_tokens'

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as Partial<Tokens>
    return typeof t.accessToken === 'string' && typeof t.refreshToken === 'string'
      ? { accessToken: t.accessToken, refreshToken: t.refreshToken }
      : null
  } catch {
    return null
  }
}

export function saveTokens(tokens: Tokens): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tokens))
  } catch {
    // storage unavailable: the session just won't survive a reload
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // storage unavailable
  }
}
