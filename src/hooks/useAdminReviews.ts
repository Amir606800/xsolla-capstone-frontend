import { useCallback, useEffect, useState } from 'react'
import { fetchAllReviews, fetchMissingReviews } from '../api/adminReviews'
import type { AdminReview, MissingReview } from '../types/mentorReview'

/** `unavailable` = the server has no mentor-review list yet (not an error: the page says so). */
export type ReviewsStatus = 'loading' | 'ready' | 'unavailable' | 'error'

/** Every mentor review, loaded once per visit to the page (and again on "Refresh"). */
export function useAdminReviews() {
  const [status, setStatus] = useState<ReviewsStatus>('loading')
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    fetchAllReviews().then(
      (rows) => {
        if (!alive) return
        setReviews(rows ?? [])
        setStatus(rows === null ? 'unavailable' : 'ready')
      },
      () => alive && setStatus('error'),
    )
    return () => {
      alive = false
    }
  }, [attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  return { status, reviews, reload }
}

/**
 * The students who still owe the review of one week. `undefined` while it loads, `null` when the server cannot say
 * (the page leaves the part out), a list otherwise; `'all'` asks for nothing. Loaded again when `version` changes
 * (the reviews were reloaded), and an answer for another week is never shown.
 */
export function useMissingReviews(moduleId: string, version: unknown): MissingReview[] | null | undefined {
  const [answer, setAnswer] = useState<{ moduleId: string; rows: MissingReview[] | null } | null>(null)

  useEffect(() => {
    if (moduleId === 'all') return
    let alive = true
    fetchMissingReviews(moduleId).then(
      (rows) => alive && setAnswer({ moduleId, rows }),
      () => alive && setAnswer({ moduleId, rows: null }),
    )
    return () => {
      alive = false
    }
  }, [moduleId, version])

  if (moduleId === 'all') return null
  return answer?.moduleId === moduleId ? answer.rows : undefined
}
