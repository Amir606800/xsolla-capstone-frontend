export const MIN_SIGNUP_PASSWORD_LENGTH = 8

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

/** Sign in only needs a non-empty password; sign up enforces the minimum length. */
export function isValidPassword(password: string, isSignup: boolean): boolean {
  return isSignup ? password.length >= MIN_SIGNUP_PASSWORD_LENGTH : password.length > 0
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm
}
