import { useCallback, useEffect, useState } from 'react'
import { fetchMentorTeam, fetchMyTeam } from '../api/teams'
import type { LoadStatus } from '../context/courses'
import type { Team } from '../types/team'
import { canMentor } from '../utils/roles'
import { useAuth } from './useAuth'

/**
 * The signed-in user's team: a student's own team, or the team a mentor looks after.
 * Anyone else (e.g. a lecturer who is not a mentor) has no team: status 'ready', team null.
 */
export function useMyTeam() {
  const { user } = useAuth()
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [team, setTeam] = useState<Team | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const isMentor = canMentor(user)
    const load = isMentor
      ? fetchMentorTeam(user)
      : user.roles.includes('student')
        ? fetchMyTeam(user)
        : Promise.resolve(null)
    load
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
