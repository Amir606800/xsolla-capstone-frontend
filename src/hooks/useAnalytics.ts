import { useCallback, useEffect, useState } from 'react'
import { fetchAiSummary, fetchLectureExpected, fetchMentor, fetchOverview, fetchPeople, fetchStudent } from '../api/analytics'
import { ApiError } from '../api/http'
import type { LoadStatus } from '../context/courses'
import type { Topic } from '../sync/bus'
import type { AiSummary, AnalyticsPerson, AnalyticsRole } from '../types/analytics'
import { sameData } from '../utils/same'
import { useLive } from './useLive'

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
 * is not shown; nothing is written synchronously from the effect. With `topics`, what is on screen is also loaded again
 * quietly (no spinner, failures ignored, equal data changes nothing) when something of those kinds is saved, so a grade
 * or a review given elsewhere shows here without a reload.
 */
function useLoaded<T>(load: () => Promise<T>, key: string, topics: readonly Topic[] = []): Loaded<T> {
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

  const quiet = useCallback(() => {
    load().then(
      (data) =>
        setSettled((prev) =>
          prev && prev.key === requestKey && 'data' in prev && !sameData(prev.data, data) ? { key: requestKey, data } : prev,
        ),
      () => undefined,
    )
  }, [load, requestKey])
  const shown = !!settled && settled.key === requestKey && 'data' in settled
  useLive(topics, quiet, { enabled: topics.length > 0 && shown })

  const reload = useCallback(() => setAttempt((a) => a + 1), [])
  if (!settled || settled.key !== requestKey) return { status: 'loading', data: null, error: null, reload }
  return 'error' in settled
    ? { status: 'error', data: null, error: settled.error, reload }
    : { status: 'ready', data: settled.data, error: null, reload }
}

export function useOverview(from: string, to: string) {
  const load = useCallback(() => fetchOverview(from || undefined, to || undefined), [from, to])
  return useLoaded(load, `${from}|${to}`, ['standings', 'directory'])
}

export function useStudentAnalytics(id: number | null, from: string, to: string) {
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : fetchStudent(id, from || undefined, to || undefined)),
    [id, from, to],
  )
  return useLoaded(load, `${id}|${from}|${to}`, ['courses'])
}

export function useMentorAnalytics(id: number | null, from: string, to: string) {
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : fetchMentor(id, from || undefined, to || undefined)),
    [id, from, to],
  )
  return useLoaded(load, `${id}|${from}|${to}`, ['reviews', 'standings', 'directory'])
}

/** How many students could answer each lecture (for the response rate); `{}` when the server cannot say. */
export function useLectureExpected() {
  return useLoaded(fetchLectureExpected, 'expected', ['feedback', 'events', 'directory'])
}

// ---------- the AI summary ----------

/** `off` = the AI service is not available (503); `missing` = the server has no such summary route. */
export type SummaryProblem = 'off' | 'missing' | 'failed'

export interface SummaryState {
  status: 'loading' | 'ready' | 'problem'
  data: AiSummary | null
  problem: SummaryProblem | null
  error: string | null
  /** A new summary is being written while the old one stays on screen. */
  busy: boolean
  /** Asks for a new summary instead of the cached one (`force_refresh`). */
  regenerate: () => void
  retry: () => void
}

function classify(e: unknown): { problem: SummaryProblem; error: string } {
  if (e instanceof ApiError) {
    if (e.status === 503) return { problem: 'off', error: 'The AI summary service is not available right now.' }
    if ((e.status === 404 && e.code !== 'not_found') || e.status === 405 || e.status === 501) {
      return { problem: 'missing', error: 'The server cannot write this summary yet.' }
    }
    if (e.status === 429)
      return { problem: 'failed', error: 'Too many summaries were asked for just now. Try again in a minute.' }
    if (e.status === 502) return { problem: 'failed', error: 'The AI could not write a usable summary this time. Try again.' }
  }
  return { problem: 'failed', error: reason(e) }
}

type SummarySettled = { key: string; request: number } & ({ data: AiSummary } | { problem: SummaryProblem; error: string })

/**
 * The AI summary of a person's feedback for the period on screen. Asked for once when the page opens (the server keeps
 * a cache, so a second visit costs nothing) and again only when the period changes or the admin presses Regenerate:
 * never on the live refresh, because a new summary is slow and paid for.
 */
export function useAiSummary(role: AnalyticsRole, id: number | null, from: string, to: string): SummaryState {
  const key = `${role}|${id}|${from}|${to}`
  // `force` belongs to the person and period it was pressed for: another period starts from the cache again
  const [request, setRequest] = useState({ n: 0, force: false, key })
  const [settled, setSettled] = useState<SummarySettled | null>(null)

  useEffect(() => {
    if (id === null) return
    let alive = true
    const n = request.n
    const force = request.force && request.key === key
    fetchAiSummary(role, id, { from: from || undefined, to: to || undefined, force }).then(
      (data) => alive && setSettled({ key, request: n, data }),
      (e: unknown) => alive && setSettled({ key, request: n, ...classify(e) }),
    )
    return () => {
      alive = false
    }
  }, [role, id, from, to, key, request])

  const regenerate = useCallback(() => setRequest((r) => ({ n: r.n + 1, force: true, key })), [key])
  const retry = useCallback(() => setRequest((r) => ({ n: r.n + 1, force: false, key })), [key])

  // an answer for another person or period is never shown; while a new one is written the old one stays
  const current = settled && settled.key === key ? settled : null
  const busy = !!current && current.request !== request.n
  if (!current || (busy && !('data' in current)))
    return { status: 'loading', data: null, problem: null, error: null, busy: false, regenerate, retry }
  return 'data' in current
    ? { status: 'ready', data: current.data, problem: null, error: null, busy, regenerate, retry }
    : { status: 'problem', data: null, problem: current.problem, error: current.error, busy: false, regenerate, retry }
}

// ---------- the people pickers ----------

const PAGE_SIZE = 20
const DEBOUNCE_MS = 300

interface PeoplePage {
  key: string
  rows: AnalyticsPerson[]
  done: boolean
}

/** Server-side paging for the student/mentor pickers: a debounced search, then "Show more" by offset. */
export function useAnalyticsPeople(role: AnalyticsRole, search: string) {
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

  const status: LoadStatus = page?.key === requestKey ? 'ready' : failure?.key === requestKey ? 'error' : 'loading'
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
