import type { CalendarEvent } from '../types/calendar'
import { authedRequest } from './authed'
import { eventToApi, isServerId, mapEvent } from './mappers'
import type { ApiEvent } from './types'

/**
 * Real calendar calls (internal/handlers/event.go). Lectures, meetings and off-campus days only:
 * deadlines come from the tasks and 1:1 times from the slots, the client adds those itself.
 *   GET    /events?from=&to=     (RFC 3339; the server defaults to one month back .. two months ahead)
 *   POST   /events               teacher / admin
 *   PATCH  /events/:id
 *   DELETE /events/:id
 */

const DAY = 86_400_000

/** A wide window so the months around today are covered when the user pages the calendar. */
function range(now: Date): string {
  const from = new Date(now.getTime() - 120 * DAY).toISOString()
  const to = new Date(now.getTime() + 240 * DAY).toISOString()
  return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
}

export async function fetchEvents(now: Date = new Date()): Promise<CalendarEvent[]> {
  const rows = await authedRequest<ApiEvent[] | null>(`/events${range(now)}`)
  return (rows ?? []).map(mapEvent)
}

/** Creates (app-made id) or edits (numeric server id) an event, then reloads the list. */
export async function saveEvent(event: CalendarEvent): Promise<CalendarEvent[]> {
  const body = eventToApi(event)
  if (isServerId(event.id)) await authedRequest(`/events/${event.id}`, { method: 'PATCH', body })
  else await authedRequest('/events', { method: 'POST', body })
  return fetchEvents()
}

export async function deleteEvent(id: string): Promise<CalendarEvent[]> {
  await authedRequest<void>(`/events/${id}`, { method: 'DELETE' })
  return fetchEvents()
}
