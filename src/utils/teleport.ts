function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function attachLmsSession(rawUrl: string): string {
  try {
    const isDefaultPlaceholder = rawUrl === 'https://example.com/office-tour'
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const baseTarget =
      isDefaultPlaceholder && isLocal
        ? window.location.port === '5174'
          ? 'http://localhost:5173'
          : 'http://localhost:5174'
        : rawUrl

    const payload = {
      user: readJson('auth_user'),
      tokens: readJson('auth_tokens'),
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      apiUrl: (import.meta.env.VITE_API_URL ?? '').trim(),
      standings: readJson('standings'),
      courseEdits: readJson('course_edits'),
      eventEdits: readJson('event_edits'),
      submissions: readJson('submissions'),
    }
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)))
    const target = new URL(baseTarget, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174')
    target.searchParams.set('lms_session', encoded)
    return target.toString()
  } catch {
    return rawUrl
  }
}

export function goTo(url: string): void {
  window.location.assign(attachLmsSession(url))
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
