import { useCallback, useEffect, useRef, useState } from 'react'
import type { Topic } from '../sync/bus'
import { useLive } from './useLive'

/**
 * `useLive` for data that lives in a provider above the pages: it only keeps itself up to date while a page is using it.
 * A page that reads the data calls `watch()` (the `useCourses` / `useStandings` hooks do it); while at least one page does,
 * the data refreshes like useLive says (the timer, a save anywhere, coming back to the tab), and once when the first page
 * starts watching (the data may be old by then). When no page watches, nothing is asked: a screen that is not open costs no requests.
 * Returns `watch`, which gives back the function that stops watching.
 */
export function useWatchedLive(topics: readonly Topic[], refresh: () => void, ready: boolean) {
  const count = useRef(0)
  const [watched, setWatched] = useState(false)
  const watch = useCallback(() => {
    count.current += 1
    setWatched(true)
    return () => {
      count.current -= 1
      if (count.current === 0) setWatched(false)
    }
  }, [])

  const latest = useRef({ refresh, ready })
  useEffect(() => {
    latest.current = { refresh, ready }
  })
  useEffect(() => {
    if (watched && latest.current.ready) latest.current.refresh()
  }, [watched])

  useLive(topics, refresh, { enabled: ready && watched })
  return watch
}
