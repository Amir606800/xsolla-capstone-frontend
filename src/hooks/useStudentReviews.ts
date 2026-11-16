import { useCallback, useEffect, useState } from 'react'
import { fetchStudentReviews } from '../api/studentReviews'
import type { StudentReview } from '../types/studentReview'
import { keepIfSame } from '../utils/same'
import { useLive } from './useLive'
import type { ReviewsStatus } from './useAdminReviews'

/** Every mentor's grade of every student, loaded once per visit to the page, and again when grades or people change. */
export function useStudentReviews() {
  const [status, setStatus] = useState<ReviewsStatus>('loading')
  const [reviews, setReviews] = useState<StudentReview[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    fetchStudentReviews().then(
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

  // a grade a mentor gives shows on the page without pressing Refresh
  const refresh = useCallback(() => {
    fetchStudentReviews().then(
      (rows) => {
        if (rows) setReviews(keepIfSame(rows))
      },
      () => undefined,
    )
  }, [])
  useLive(['standings', 'directory'], refresh, { enabled: status === 'ready' })

  return { status, reviews, reload }
}
