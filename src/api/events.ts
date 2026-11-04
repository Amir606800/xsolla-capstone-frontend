import { buildMockEvents } from '../mocks/events'
import type { CalendarEvent } from '../types/calendar'

/**
 * MOCK implementation - no backend yet (the design doc has no events endpoint).
 * Expected real shape: GET /events?from=&to= -> CalendarEvent-like rows
 * (title, start, end, kind). Task deadlines are NOT part of this response;
 * the client derives them from assignments.
 */
const MOCK_LATENCY_MS = 300

export async function fetchEvents(): Promise<CalendarEvent[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return buildMockEvents()
}
