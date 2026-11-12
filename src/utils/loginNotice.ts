const KEY = 'login_notice'

/** A line for the next sign-in screen (e.g. after a password change signed the person out). Survives the redirect. */
export function setLoginNotice(text: string): void {
  try {
    sessionStorage.setItem(KEY, text)
  } catch {
    /* storage unavailable: the notice is just not shown */
  }
}

/** Reads the line once and forgets it. */
export function takeLoginNotice(): string | undefined {
  try {
    const text = sessionStorage.getItem(KEY) ?? undefined
    sessionStorage.removeItem(KEY)
    return text
  } catch {
    return undefined
  }
}
