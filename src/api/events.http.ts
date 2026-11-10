import type { CalendarEvent } from '../types/calendar'
import type { SaveOptions, SaveResult } from '../types/google'
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

/**
 * Creates (app-made id) or edits (numeric server id) an event, then reloads the list.
 * `syncToGoogle` only applies to a new event (PATCH has no such field). The server never fails the event
 * when Google refuses; the only sign is a created row without `google_event_id`, which is reported as 'failed'.
 */
export async function saveEvent(event: CalendarEvent, { syncToGoogle = false }: SaveOptions = {}): Promise<SaveResult> {
  const body = eventToApi(event)
  let google: SaveResult['google'] = 'not-asked'
  if (isServerId(event.id)) {
    await authedRequest(`/events/${event.id}`, { method: 'PATCH', body })
  } else {
    const created = await authedRequest<ApiEvent | null>('/events', {
      method: 'POST',
      body: syncToGoogle ? { ...body, sync_to_google: true } : body,
    })
    if (syncToGoogle) google = created?.google_event_id ? 'synced' : 'failed'
  }
  return { events: await fetchEvents(), google }
}

export async function deleteEvent(id: string): Promise<CalendarEvent[]> {
  await authedRequest<void>(`/events/${id}`, { method: 'DELETE' })
  return fetchEvents()
}
