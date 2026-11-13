import { useCallback, useEffect, useState } from 'react'
import { fetchGoogleCalendar } from '../api/google'
import type { CalendarEvent } from '../types/calendar'
import { useGoogle } from './useGoogle'

export type GoogleEventsStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * The signed-in person's own Google Calendar events, for the LMS calendar page only (the staff dashboard and the admin
 * calendar do not use it). Never blocks the page and never fails it: nothing is asked while Google is not connected, a
 * server without the route simply gives no events, and a failure is a status the page shows as a quiet "retry".
 */
export function useGoogleCalendarEvents() {
  const google = useGoogle()
  const connection = google.status?.connection
  const { markReconnect } = google
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [status, setStatus] = useState<GoogleEventsStatus>('idle')
  const [attempt, setAttempt] = useState(0)
  const connected = connection === 'connected'

  useEffect(() => {
    if (!connected) return
    let cancelled = false
    fetchGoogleCalendar()
      .then((result) => {
        if (cancelled) return
        if (result.state === 'reconnect') {
          markReconnect()
          setEvents([])
          setStatus('idle')
        } else {
          setEvents(result.state === 'ok' ? result.events : [])
          setStatus('ready')
        }
      })
      .catch(() => {
        if (cancelled) return
        setEvents([])
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [connected, attempt, markReconnect])

  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])
  // what was learned while connected does not count once it is not (revoked, signed out)
  return { events: connected ? events : [], status: connected ? status : ('idle' as GoogleEventsStatus), connection, retry }
}
