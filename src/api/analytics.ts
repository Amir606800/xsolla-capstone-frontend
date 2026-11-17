import type { AiSummary, AnalyticsPerson, AnalyticsRole } from '../types/analytics'
import { hasRole } from '../utils/roles'
import { fetchUsers } from './directory'
import * as http from './analytics.http'

/** The backend's admin analytics routes (./analytics.http). */
export async function fetchOverview(from?: string, to?: string) {
  return http.fetchOverview(from, to)
}

/**
 * The people picker. Students and mentors come from the analytics selectors (GET /analytics/students|mentors). The
 * backend has no lecturer selector, so lecturers are the people list (GET /users) with the lecturer role, searched and
 * paged here.
 */
export async function fetchPeople(role: AnalyticsRole, q: string, limit: number, offset: number): Promise<AnalyticsPerson[]> {
  if (role === 'lecturers') {
    const needle = q.trim().toLowerCase()
    return (await fetchUsers())
      .filter((u) => !u.leftAt && hasRole(u, 'lecturer'))
      .filter((u) => !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(offset, offset + limit)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }))
  }
  return http.fetchPeople(role, q, limit, offset)
}

export async function fetchStudent(id: number, from?: string, to?: string) {
  return http.fetchStudent(id, from, to)
}

export async function fetchMentor(id: number, from?: string, to?: string) {
  return http.fetchMentor(id, from, to)
}

/** The AI summary of what was said to / about this person in the period. `force` asks for a new one instead of the cached one. */
export async function fetchAiSummary(
  role: AnalyticsRole,
  id: number,
  opts: { from?: string; to?: string; force?: boolean } = {},
): Promise<AiSummary> {
  return http.fetchAiSummary(role, id, opts)
}

/** How many students could answer each lecture, keyed like `lectureKey`; `{}` when the server cannot say. */
export async function fetchLectureExpected(): Promise<Record<string, number>> {
  return http.fetchLectureExpected()
}
