/** Leaves the app for another site in the same tab. Its own module so tests can replace it. */
export function goTo(url: string): void {
  window.location.assign(url)
}

/** True when the user asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
