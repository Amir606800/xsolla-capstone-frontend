import { useCallback, useEffect, useState } from 'react'
import { deleteEvent, fetchEvents, saveEvent } from '../api/events'
import { useGoogle } from './useGoogle'
import type { LoadStatus } from '../context/courses'
import type { CalendarEvent } from '../types/calendar'
import type { GoogleOutcome, SaveOptions } from '../types/google'

/**
 * Loads calendar events once per mount. Lecturers can also add, change and delete them;
 * the screen then shows the list the server returns.
 */
export function useCalendarEvents() {
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [attempt, setAttempt] = useState(0)
  const { reload: reloadGoogle } = useGoogle({ load: false })

  useEffect(() => {
    let cancelled = false
    fetchEvents()
      .then((data) => {
        if (cancelled) return
        setEvents(data)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  /** Saves the event and says what happened to its Google copy (when one was asked for). */
  const save = useCallback(async (event: CalendarEvent, options?: SaveOptions): Promise<GoogleOutcome> => {
    const result = await saveEvent(event, options)
    setEvents(result.events)
    // the event is saved but Google did not take it: find out why (a revoked connection shows as "reconnect")
    if (result.google === 'failed') void reloadGoogle()
    return result.google
  }, [reloadGoogle])
  const remove = useCallback(async (id: string) => setEvents(await deleteEvent(id)), [])

  return { status, events, reload, save, remove }
}
