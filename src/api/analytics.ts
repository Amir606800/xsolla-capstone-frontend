import { mockMentor, mockOverview, mockPeople, mockStudent } from '../mocks/analytics'
import { hasBackend } from './http'
import * as http from './analytics.http'

/** Real backend when VITE_API_URL is set, the offline demo otherwise. */
export async function fetchOverview(from?: string, to?: string) {
  return hasBackend() ? http.fetchOverview(from, to) : mockOverview()
}

export async function fetchPeople(role: 'students' | 'mentors', q: string, limit: number, offset: number) {
  return hasBackend() ? http.fetchPeople(role, q, limit, offset) : mockPeople(role, q, limit, offset)
}

export async function fetchStudent(id: number, from?: string, to?: string) {
  return hasBackend() ? http.fetchStudent(id, from, to) : mockStudent(id)
}

export async function fetchMentor(id: number, from?: string, to?: string) {
  return hasBackend() ? http.fetchMentor(id, from, to) : mockMentor(id)
}
