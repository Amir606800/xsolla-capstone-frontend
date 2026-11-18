import { useCallback, useEffect, useRef, useState } from 'react'
import { createDiscussion, fetchDiscussions, removeDiscussion } from '../api/discussions'
import type { LoadStatus } from '../context/courses'
import type { Discussion, DiscussionDraft } from '../types/discussion'
import { canMentor, isStudent } from '../utils/roles'
import { useAuth } from './useAuth'
import { useLive } from './useLive'

/**
 * The talks of the signed-in person: a mentor's own, or the ones a student is invited to. Anyone else has none (nothing is
 * asked). The calendar still works when the talks cannot be loaded (`status` 'error'): they are an extra.
 */
export function useDiscussions() {
  const { user } = useAuth()
  const relevant = canMentor(user) || isStudent(user)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [talks, setTalks] = useState<Discussion[]>([])

  useEffect(() => {
    if (!user || !relevant) return
    let cancelled = false
    fetchDiscussions()
      .then((data) => {
        if (cancelled) return
        setTalks(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [user, relevant])

  // a talk set up (or cancelled) by the mentor shows up for the students without a reload; an answer that was on its way
  // when the person did something is older than what that action returned, so it is dropped
  const version = useRef(0)
  const refresh = useCallback(() => {
    const started = version.current
    fetchDiscussions().then(
      (data) => {
        if (version.current === started) setTalks(data)
      },
      () => undefined,
    )
  }, [])
  useLive(['slots'], refresh, { enabled: status === 'ready' && relevant })

  const add = useCallback(async (draft: DiscussionDraft) => {
    const next = await createDiscussion(draft)
    version.current += 1
    setTalks(next)
  }, [])
  const remove = useCallback(async (id: string) => {
    const next = await removeDiscussion(id)
    version.current += 1
    setTalks(next)
  }, [])

  return {
    status: relevant ? status : ('ready' as const),
    talks: relevant ? talks : [],
    add,
    remove,
  }
}
