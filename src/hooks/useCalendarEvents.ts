import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteEvent, fetchEvents, saveEvent } from '../api/events'
import { useAutoRefresh } from './useAutoRefresh'
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

  // Quiet refresh: what a lecturer adds or changes reaches everyone who has the calendar open, without a reload. The list a save
  // returns is newer than an answer that was still on its way when the save happened, so that older answer is dropped.
  const version = useRef(0)
  const refresh = useCallback(() => {
    const started = version.current
    fetchEvents().then(
      (data) => {
        if (version.current === started) setEvents(data)
      },
      () => undefined,
    )
  }, [])
  useAutoRefresh(refresh, { enabled: status === 'ready' })

  /** Saves the event and says what happened to its Google copy (when one was asked for). */
  const save = useCallback(
    async (event: CalendarEvent, options?: SaveOptions): Promise<{ google: GoogleOutcome; meetingLinkLost: boolean }> => {
      const result = await saveEvent(event, options)
      version.current += 1
      setEvents(result.events)
      // the event is saved but Google did not take it: find out why (a revoked connection shows as "reconnect")
      if (result.google === 'failed') void reloadGoogle()
      return { google: result.google, meetingLinkLost: !!result.meetingLinkLost }
    },
    [reloadGoogle],
  )
  const remove = useCallback(async (id: string) => {
    const next = await deleteEvent(id)
    version.current += 1
    setEvents(next)
  }, [])

  return { status, events, reload, save, remove }
}
