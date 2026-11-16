import { useCallback, useEffect, useState } from 'react'
import { fetchMentor, fetchOverview, fetchPeople, fetchStudent } from '../api/analytics'
import type { LoadStatus } from '../context/courses'
import type { AnalyticsPerson } from '../types/analytics'

/** One loaded resource: its state, its data, and a way to try again. `data` is null in the not-found case. */
export interface Loaded<T> {
  status: LoadStatus
  data: T | null
  error: string | null
  reload: () => void
}

const reason = (e: unknown) => (e instanceof Error ? e.message : 'Could not load analytics.')

type Settled<T> = { key: string; data: T } | { key: string; error: string }

/**
 * Runs `load` whenever its identity changes. The result carries the request key, so a late answer for an old request
 * is not shown; nothing is written synchronously from the effect.
 */
function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const requestKey = `${key}#${attempt}`

  useEffect(() => {
    let alive = true
    load().then(
      (data) => {
        if (alive) setSettled({ key: requestKey, data })
      },
      (e: unknown) => {
        if (alive) setSettled({ key: requestKey, error: reason(e) })
      },
    )
    return () => {
      alive = false
    }
  }, [load, requestKey])

  const reload = useCallback(() => setAttempt((a) => a + 1), [])
  if (!settled || settled.key !== requestKey) return { status: 'loading', data: null, error: null, reload }
  return 'error' in settled
    ? { status: 'error', data: null, error: settled.error, reload }
    : { status: 'ready', data: settled.data, error: null, reload }
}

export function useOverview(from: string, to: string) {
  const load = useCallback(() => fetchOverview(from || undefined, to || undefined), [from, to])
  return useLoaded(load, `${from}|${to}`)
}

export function useStudentAnalytics(id: number | null, from: string, to: string) {
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : fetchStudent(id, from || undefined, to || undefined)),
    [id, from, to],
  )
  return useLoaded(load, `${id}|${from}|${to}`)
}

export function useMentorAnalytics(id: number | null, from: string, to: string) {
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : fetchMentor(id, from || undefined, to || undefined)),
    [id, from, to],
  )
  return useLoaded(load, `${id}|${from}|${to}`)
}

const PAGE_SIZE = 20
const DEBOUNCE_MS = 300

interface PeoplePage {
  key: string
  rows: AnalyticsPerson[]
  done: boolean
}

/** Server-side paging for the student/mentor pickers: a debounced search, then "Show more" by offset. */
export function useAnalyticsPeople(role: 'students' | 'mentors', search: string) {
  const [query, setQuery] = useState(search)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState<PeoplePage | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: string } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestKey = `${role}|${query}|${attempt}`

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let alive = true
    fetchPeople(role, query, PAGE_SIZE, 0).then(
      (rows) => {
        if (alive) setPage({ key: requestKey, rows, done: rows.length < PAGE_SIZE })
      },
      (e: unknown) => {
        if (alive) setFailure({ key: requestKey, error: reason(e) })
      },
    )
    return () => {
      alive = false
    }
  }, [requestKey, role, query])

  const loadMore = useCallback(async () => {
    if (loadingMore || !page || page.key !== requestKey || page.done) return
    const started = requestKey
    setLoadingMore(true)
    try {
      const rows = await fetchPeople(role, query, PAGE_SIZE, page.rows.length)
      // only append to the page that is still on screen; an answer for an old search is dropped
      setPage((prev) =>
        prev && prev.key === started ? { key: started, rows: [...prev.rows, ...rows], done: rows.length < PAGE_SIZE } : prev,
      )
    } catch {
      // the rows already on screen stay; pressing again retries this page
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, page, query, requestKey, role])

  const status: LoadStatus =
    page?.key === requestKey ? 'ready' : failure?.key === requestKey ? 'error' : 'loading'
  return {
    status,
    people: page?.key === requestKey ? page.rows : [],
    error: failure?.key === requestKey ? failure.error : null,
    loadingMore,
    done: page?.key === requestKey ? page.done : false,
    loadMore,
    reload: () => setAttempt((a) => a + 1),
  }
}
