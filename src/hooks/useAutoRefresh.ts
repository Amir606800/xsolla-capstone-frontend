import { useEffect, useRef } from 'react'

/** How often a screen that is open and in front asks the server again. */
export const REFRESH_EVERY_MS = 30_000

/**
 * Keeps a screen up to date without the person pressing anything: `refresh` runs
 *  - when the tab comes back to the front, or the window gets focus (the person was somewhere else meanwhile),
 *  - and every `everyMs` while the tab is in front (a hidden tab does not ask).
 * `refresh` should be quiet: no loading spinner, and a failure is ignored (the next try may work).
 */
export function useAutoRefresh(refresh: () => void, { everyMs = REFRESH_EVERY_MS, enabled = true } = {}) {
  const latest = useRef(refresh)
  useEffect(() => {
    latest.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    const run = () => {
      if (document.visibilityState === 'visible') latest.current()
    }
    const timer = window.setInterval(run, everyMs)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [enabled, everyMs])
}
