import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchTeamStandings, saveWeekGrade, type StoredStanding } from '../api/standings'
import type { LoadStatus } from '../context/courses'
import type { StandingLevel } from '../types/standing'
import { canMentor } from '../utils/roles'
import { keepIfSame } from '../utils/same'
import { useAuth } from './useAuth'
import { useLive } from './useLive'

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

  // grades given from another screen or another mentor's tab show here without a reload
  const version = useRef(0)
  const refresh = useCallback(() => {
    if (!mentor) return
    const started = version.current
    fetchTeamStandings(mentor).then(
      (data) => {
        if (version.current === started) setStandings(keepIfSame(data))
      },
      () => undefined,
    )
  }, [mentor])
  useLive(['standings', 'directory'], refresh, { enabled: !!mentor && status === 'ready' })

  const gradeWeek = useCallback(
    async (studentId: number, week: number, level: StandingLevel, note: string) => {
      if (!mentor) throw new Error('Only mentors can grade a week')
      const saved = await saveWeekGrade(mentor, studentId, week, level, note)
      version.current += 1
      setStandings(saved)
      // what the store now holds for this student and week (the server may not have kept the feedback)
      return saved.find((s) => s.studentId === studentId && s.week === week)
    },
    [mentor],
  )

  return { status, standings, reload, gradeWeek }
}
