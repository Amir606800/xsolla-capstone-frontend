import { useCallback, useEffect, useMemo, useState } from 'react'
import { bookSlot, cancelBooking, createAvailability, fetchSlots, removeSlot } from '../api/slots'
import type { LoadStatus } from '../context/courses'
import type { AvailabilityWindow, MeetingSlot } from '../types/slots'
import { useAuth } from './useAuth'

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

  const actor = useMemo(() => (user ? { id: user.id, name: user.name, role: user.role } : null), [user])

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

  const run = useCallback(
    async (action: (a: NonNullable<typeof actor>) => Promise<MeetingSlot[]>): Promise<MeetingSlot[]> => {
      if (!actor) throw new Error('Please sign in')
      try {
        const next = await action(actor)
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
