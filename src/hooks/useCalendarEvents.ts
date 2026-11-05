import { useCallback, useEffect, useState } from 'react'
import { deleteEvent, fetchEvents, saveEvent } from '../api/events'
import type { LoadStatus } from '../context/courses'
import type { CalendarEvent } from '../types/calendar'

/**
 * Loads calendar events once per mount. Lecturers can also add, change and delete them;
 * the screen then shows the list the server returns.
 */
export function useCalendarEvents() {
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [attempt, setAttempt] = useState(0)

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

  const save = useCallback(async (event: CalendarEvent) => setEvents(await saveEvent(event)), [])
  const remove = useCallback(async (id: string) => setEvents(await deleteEvent(id)), [])

  return { status, events, reload, save, remove }
}
