import { listEvents, putEvent, removeEvent } from '../mocks/contentEdits'
import type { CalendarEvent } from '../types/calendar'

/**
 * MOCK implementation - no backend yet (the design doc has no events endpoint).
 * Expected real shape: GET /events?from=&to= -> CalendarEvent-like rows
 * (title, start, end, kind). Task deadlines and 1:1 times are NOT part of this response;
 * the client derives them from assignments and slots.
 * Lecturers (teacher/admin only): POST /events, PATCH /events/:id, DELETE /events/:id.
 * Each call here returns the whole updated list.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function fetchEvents(): Promise<CalendarEvent[]> {
  await wait()
  return listEvents()
}

export async function saveEvent(event: CalendarEvent): Promise<CalendarEvent[]> {
  await wait()
  return putEvent(event)
}

export async function deleteEvent(id: string): Promise<CalendarEvent[]> {
  await wait()
  return removeEvent(id)
}
