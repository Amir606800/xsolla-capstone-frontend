import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchTeamStandings, saveWeekGrade, type StoredStanding } from '../api/standings'
import type { LoadStatus } from '../context/courses'
import type { StandingLevel } from '../types/standing'
import { canMentor } from '../utils/roles'
import { useAuth } from './useAuth'

/** Mentor: the weekly green / yellow / red grades of their team, and giving them. */
export function useTeamStandings() {
  const { user } = useAuth()
  const mentor = useMemo(() => (user && canMentor(user) ? { id: user.id, name: user.name } : null), [user])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [standings, setStandings] = useState<StoredStanding[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!mentor) return
    let cancelled = false
    fetchTeamStandings(mentor)
      .then((data) => {
        if (cancelled) return
        setStandings(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [mentor, attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  const gradeWeek = useCallback(
    async (studentId: number, week: number, level: StandingLevel, note: string) => {
      if (!mentor) throw new Error('Only mentors can grade a week')
      setStandings(await saveWeekGrade(mentor, studentId, week, level, note))
    },
    [mentor],
  )

  return { status, standings, reload, gradeWeek }
}
