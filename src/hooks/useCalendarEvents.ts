import { useCallback, useEffect, useState } from 'react'
import { fetchEvents } from '../api/events'
import type { LoadStatus } from '../context/courses'
import type { CalendarEvent } from '../types/calendar'

/** Loads calendar events once per mount. Only the Calendar page needs them for now. */
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

  return { status, events, reload }
}
