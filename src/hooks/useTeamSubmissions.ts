import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { commentOnSubmission, fetchTeamSubmissions } from '../api/reviews'
import type { LoadStatus } from '../context/courses'
import type { TeamSubmission } from '../types/review'
import { canMentor } from '../utils/roles'
import { keepIfSame } from '../utils/same'
import { useAuth } from './useAuth'
import { useLive } from './useLive'

/** Mentor: the work their team handed in, and commenting on it. Nothing is loaded for anyone else. */
export function useTeamSubmissions() {
  const { user } = useAuth()
  const mentor = useMemo(() => (user && canMentor(user) ? { id: user.id, name: user.name } : null), [user])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [submissions, setSubmissions] = useState<TeamSubmission[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!mentor) return
    let cancelled = false
    fetchTeamSubmissions(mentor)
      .then((data) => {
        if (cancelled) return
        setSubmissions(data)
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

  // what a student hands in shows up for the mentor without a reload
  const version = useRef(0)
  const refresh = useCallback(() => {
    if (!mentor) return
    const started = version.current
    fetchTeamSubmissions(mentor).then(
      (data) => {
        if (version.current === started) setSubmissions(keepIfSame(data))
      },
      () => undefined,
    )
  }, [mentor])
  useLive(['courses', 'directory'], refresh, { enabled: !!mentor && status === 'ready' })

  const comment = useCallback(
    async (studentId: number, assignmentId: string, text: string) => {
      if (!mentor) throw new Error('Only mentors can comment')
      const next = await commentOnSubmission(mentor, studentId, assignmentId, text)
      version.current += 1
      setSubmissions(next)
    },
    [mentor],
  )

  return { status, submissions, reload, comment }
}
