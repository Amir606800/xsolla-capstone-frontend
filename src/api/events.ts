import { listEvents, putEvent, removeEvent } from '../mocks/contentEdits'
import type { CalendarEvent } from '../types/calendar'
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

export async function saveEvent(event: CalendarEvent): Promise<CalendarEvent[]> {
  if (hasBackend()) return http.saveEvent(event)
  await wait()
  return putEvent(event)
}

export async function deleteEvent(id: string): Promise<CalendarEvent[]> {
  if (hasBackend()) return http.deleteEvent(id)
  await wait()
  return removeEvent(id)
}
