import { noticeForSavedEvent } from '../mocks/broadcasts'
import { listEvents, putEvent, removeEvent } from '../mocks/contentEdits'
import type { CalendarEvent } from '../types/calendar'
import type { SaveOptions, SaveResult } from '../types/google'
import { mockGoogleIsReady } from '../mocks/google'
import * as http from './events.http'
import { hasBackend } from './http'

/**
 * Calendar events: the real backend when VITE_API_URL is set (./events.http), the offline mock otherwise.
 * Task deadlines and 1:1 times are NOT part of this list; the client derives them from tasks and slots.
 * Each call returns the whole updated list.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function fetchEvents(): Promise<CalendarEvent[]> {
  if (hasBackend()) return http.fetchEvents()
  await wait()
  return listEvents()
}

export async function saveEvent(event: CalendarEvent, options: SaveOptions = {}): Promise<SaveResult> {
  if (hasBackend()) return http.saveEvent(event, options)
  await wait()
  const before = listEvents().find((e) => e.id === event.id)
  // like the server: only a new event can be put on Google, an edit keeps the id it already has,
  // and a Google that is not connected leaves the event saved but without an id
  const asked = !!options.syncToGoogle && !before
  const synced = asked && mockGoogleIsReady()
  const googleEventId = synced ? `mock-${event.id}` : before?.googleEventId
  const events = putEvent(googleEventId ? { ...event, googleEventId } : event)
  // a lecture got a meeting link (or a different one): the students are told.
  // (With a backend the server does this; see BACKEND_REQUIREMENTS 4.5.)
  noticeForSavedEvent(before, event)
  return { events, google: asked ? (synced ? 'synced' : 'failed') : 'not-asked' }
}

export async function deleteEvent(id: string): Promise<CalendarEvent[]> {
  if (hasBackend()) return http.deleteEvent(id)
  await wait()
  return removeEvent(id)
}
