import { useCallback, useEffect, useState } from 'react'
import { fetchMyTeam } from '../api/teams'
import type { LoadStatus } from '../context/courses'
import type { Team } from '../types/team'
import { useAuth } from './useAuth'

/** Loads the signed-in user's team once per visit to the Team page. */
export function useMyTeam() {
  const { user } = useAuth()
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [team, setTeam] = useState<Team | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchMyTeam(user)
      .then((data) => {
        if (cancelled) return
        setTeam(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [user, attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  return { status, team, reload }
}
