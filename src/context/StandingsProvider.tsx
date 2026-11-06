import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchStandings } from '../api/standings'
import type { WeeklyStanding } from '../types/standing'
import { analyseStandings } from '../utils/standing'
import { AuthContext } from './auth'
import type { LoadStatus } from './courses'
import { StandingsContext } from './standings'

/** Loads the student's weekly standings once for the signed-in shell (dashboard and Grades share it). */
export function StandingsProvider({ children }: { children: ReactNode }) {
  // the signed-in student's own grades (falls back to the demo student outside an AuthProvider)
  const studentId = useContext(AuthContext)?.user?.id ?? 1
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [ratings, setRatings] = useState<WeeklyStanding[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchStandings(studentId)
      .then((data) => {
        if (cancelled) return
        setRatings(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt, studentId])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  const value = useMemo(
    () => ({ status, ratings, summary: analyseStandings(ratings), reload }),
    [status, ratings, reload],
  )

  return <StandingsContext.Provider value={value}>{children}</StandingsContext.Provider>
}
