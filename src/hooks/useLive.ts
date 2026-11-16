import { useEffect, useRef } from 'react'
import { subscribe } from '../sync/bus'
import type { Topic } from '../sync/bus'
import { useAutoRefresh } from './useAutoRefresh'

/**
 * Keeps what a screen shows in step with the server: `refresh` runs
 *  - at once when something of one of these topics was saved anywhere in the app (or in another tab),
 *  - when the tab comes back to the front / the connection comes back,
 *  - and every few seconds while the tab is in front, which is how a change made by somebody else arrives.
 * `refresh` must be quiet: no spinner, a failure ignored, and nothing set when the data did not change (see `keepIfSame`).
 */
export function useLive(topics: readonly Topic[], refresh: () => void, { enabled = true, everyMs }: { enabled?: boolean; everyMs?: number } = {}) {
  const latest = useRef(refresh)
  useEffect(() => {
    latest.current = refresh
  }, [refresh])

  const key = topics.join(',')
  useEffect(() => {
    if (!enabled) return
    return subscribe(key.split(',') as Topic[], () => {
      if (document.visibilityState === 'visible') latest.current()
    })
  }, [enabled, key])

  useAutoRefresh(refresh, { enabled, everyMs })
}
