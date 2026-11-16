import { useCallback, useEffect, useState } from 'react'
import { fetchLectureReviews } from '../api/adminLectureReviews'
import type { AdminLectureReview } from '../types/lectureReview'
import { keepIfSame } from '../utils/same'
import { useLive } from './useLive'
import type { ReviewsStatus } from './useAdminReviews'

/** Every lecture review, loaded once per visit to the page (and again on "Refresh"). */
export function useAdminLectureReviews() {
  const [status, setStatus] = useState<ReviewsStatus>('loading')
  const [reviews, setReviews] = useState<AdminLectureReview[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    fetchLectureReviews().then(
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

  // a form a student sends shows on the page without pressing Refresh
  const refresh = useCallback(() => {
    fetchLectureReviews().then(
      (rows) => {
        if (rows) setReviews(keepIfSame(rows))
      },
      () => undefined,
    )
  }, [])
  useLive(['feedback', 'events', 'directory'], refresh, { enabled: status === 'ready' })

  return { status, reviews, reload }
}
