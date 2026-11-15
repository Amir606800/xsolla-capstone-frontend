import { useCallback, useEffect, useState } from 'react'
import { fetchLectureReviews } from '../api/adminLectureReviews'
import type { AdminLectureReview } from '../types/lectureReview'
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

  return { status, reviews, reload }
}
