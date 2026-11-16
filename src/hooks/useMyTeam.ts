import { useCallback, useEffect, useState } from 'react'
import { fetchMentorTeam, fetchMyTeam } from '../api/teams'
import type { LoadStatus } from '../context/courses'
import type { Team } from '../types/team'
import { canMentor } from '../utils/roles'
import { keepIfSame } from '../utils/same'
import { useAuth } from './useAuth'
import { useLive } from './useLive'

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

  // the admin moving people between teams, or a profile picture changing, shows without a reload
  const refresh = useCallback(() => {
    if (!user) return
    const load = canMentor(user) ? fetchMentorTeam(user) : user.roles.includes('student') ? fetchMyTeam(user) : null
    load?.then((data) => setTeam(keepIfSame(data)), () => undefined)
  }, [user])
  useLive(['directory', 'profile'], refresh, { enabled: !!user && status === 'ready' })

  return { status, team, reload }
}
