import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bookSlot, cancelBooking, createAvailability, fetchSlots, removeSlot } from '../api/slots'
import type { LoadStatus } from '../context/courses'
import type { AvailabilityWindow, MeetingSlot } from '../types/slots'
import { useAuth } from './useAuth'
import { useAutoRefresh } from './useAutoRefresh'

/**
 * The mentor 1:1 slots for the signed-in person: a student sees their mentor's times, a mentor sees
 * their own. Every action asks the server and then shows the list it returns; when an action fails
 * (for example someone took the slot first) the list is refreshed so the screen matches the server.
 */
export function useMeetingSlots() {
  const { user } = useAuth()
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [slots, setSlots] = useState<MeetingSlot[]>([])
  const [attempt, setAttempt] = useState(0)

  const actor = useMemo(() => (user ? { id: user.id, name: user.name, roles: user.roles } : null), [user])

  useEffect(() => {
    if (!actor) return
    let cancelled = false
    fetchSlots(actor)
      .then((data) => {
        if (cancelled) return
        setSlots(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [actor, attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  // Quiet refresh: a mentor's new times, or a booking by a student, show up for the other side without a reload. An answer that
  // was still on its way when the person did something is older than what that action returned, so it is dropped.
  const version = useRef(0)
  const refresh = useCallback(() => {
    if (!actor) return
    const started = version.current
    fetchSlots(actor).then(
      (data) => {
        if (version.current === started) setSlots(data)
      },
      () => undefined,
    )
  }, [actor])
  useAutoRefresh(refresh, { enabled: status === 'ready' && !!actor })

  const run = useCallback(
    async (action: (a: NonNullable<typeof actor>) => Promise<MeetingSlot[]>): Promise<MeetingSlot[]> => {
      if (!actor) throw new Error('Please sign in')
      try {
        const next = await action(actor)
        version.current += 1
        setSlots(next)
        return next
      } catch (e) {
        // the server said no: show what it really has, then let the caller show the message
        fetchSlots(actor).then(setSlots, () => undefined)
        throw e
      }
    },
    [actor],
  )

  /** Opens a window. Resolves with how many new times were added (clashing ones are skipped). */
  const addWindow = useCallback(
    async (window: AvailabilityWindow) => {
      const before = slots.length
      const next = await run((a) => createAvailability(a, window))
      return next.length - before
    },
    [run, slots.length],
  )
  const remove = useCallback((id: string) => run((a) => removeSlot(a, id)).then(() => undefined), [run])
  const book = useCallback((id: string) => run((a) => bookSlot(a, id)).then(() => undefined), [run])
  const cancel = useCallback((id: string) => run((a) => cancelBooking(a, id)).then(() => undefined), [run])

  return { status, slots, reload, addWindow, remove, book, cancel }
}
