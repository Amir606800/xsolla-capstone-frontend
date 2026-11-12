import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { hasBackend } from '../api/http'
import { fetchReviewedWeeks, submitReview } from '../api/mentorReviews'
import { fetchMyTeam } from '../api/teams'
import { useAuth } from '../hooks/useAuth'
import { useCourses } from '../hooks/useCourses'
import { addReview, demoMode, reviewedWeeks } from '../mocks/mentorReviews'
import type { MentorReview, ReviewedWeek } from '../types/mentorReview'
import type { Person } from '../types/team'
import { reviewDue } from '../utils/mentorReview'
import { isStaff, isStudent } from '../utils/roles'
import type { LoadStatus } from './courses'
import { MentorReviewContext } from './mentorReview'

interface Loaded {
  /** null = the server has no mentor reviews yet: nobody owes one. */
  reviewed: ReviewedWeek[] | null
  mentor: Person | null
}

/**
 * The weekly mentor review of the signed-in student: which one they owe and sending it. Only students with a mentor
 * are ever asked; staff and students without a team get "nothing due" without any request.
 */
export function MentorReviewProvider({ children }: { children: ReactNode }) {
  // trying the screens against a real server that has no review routes yet: the demo flag (see mocks/mentorReviews)
  // keeps the weeks real but the reviews in this browser
  const forced = hasBackend() && demoMode() !== null
  const { user } = useAuth()
  const courses = useCourses()
  const asked = !!user && isStudent(user) && !isStaff(user)
  const userId = user?.id
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [data, setData] = useState<Loaded>({ reviewed: null, mentor: null })
  const [attempt, setAttempt] = useState(0)
  const [sentTick, setSentTick] = useState(0)

  useEffect(() => {
    if (!asked || !user) return
    let cancelled = false
    Promise.all([fetchMyTeam(user), forced ? Promise.resolve<ReviewedWeek[]>([]) : fetchReviewedWeeks(user.id)])
      .then(([team, reviewed]) => {
        if (cancelled) return
        setData({ reviewed, mentor: team?.mentor ?? null })
        setStatus('ready')
      })
      .catch(() => {
        // a review that cannot be checked never locks anyone out
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // the user object changes identity on every sign-in; the id is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, userId, attempt, forced])

  const due = useMemo(() => {
    if (!asked || status !== 'ready' || courses.status !== 'ready' || !data.reviewed || !data.mentor) return null
    const reviewed = forced && userId !== undefined ? reviewedWeeks(userId, courses.now, courses.modules) : data.reviewed
    const demoWeekend = demoMode() === 'reminder'
    return reviewDue(courses.modules, reviewed, courses.now, demoWeekend ? { weekend: true } : undefined)
    // sentTick: a review sent in forced mode lives in the browser store, outside this state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, status, courses.status, courses.modules, courses.now, data, forced, userId, sentTick])

  const submit = useCallback(
    async (review: MentorReview) => {
      if (!userId) throw new Error('Sign in to send the review')
      if (forced) {
        addReview(userId, data.mentor?.id, review, courses.now, courses.modules)
        setSentTick((t) => t + 1)
        return
      }
      const reviewed = await submitReview(userId, data.mentor?.id, review)
      setData((prev) => ({ ...prev, reviewed }))
    },
    [userId, data.mentor?.id, forced, courses.now, courses.modules],
  )

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  const value = useMemo(
    () => ({ status: asked ? status : ('ready' as LoadStatus), due, mentor: data.mentor, submit, reload }),
    [asked, status, due, data.mentor, submit, reload],
  )
  return <MentorReviewContext.Provider value={value}>{children}</MentorReviewContext.Provider>
}
