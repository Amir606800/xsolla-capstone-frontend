import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { fetchReviewedWeeks, submitReview } from './mentorReviews'
import { saveTokens } from './session'

// the shared test setup replaces this module with the demo store; here the real one is under test
vi.unmock('./mentorReviews')

const BASE = 'https://api.test'
let calls: { method: string; path: string; body?: unknown }[]

async function backend(routes: Record<string, { status: number; body?: unknown }>) {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const key = `${init.method ?? 'GET'} ${url.replace(BASE, '')}`
      calls.push({ method: init.method ?? 'GET', path: url.replace(BASE, ''), ...(init.body ? { body: JSON.parse(init.body as string) } : {}) })
      const r = routes[key]
      // a route the Go server does not have: plain text, not JSON
      return r ? new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status }) : new Response('404 page not found', { status: 404 })
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', BASE)
  saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('mentor reviews on the real backend', () => {
  it('reads the reviewed weeks', async () => {
    await backend({ 'GET /mentor-reviews/me': { status: 200, body: [{ module_id: 4, submitted_at: '2026-11-15T10:00:00Z' }] } })
    expect(await fetchReviewedWeeks(1)).toEqual([{ moduleId: '4', submittedAt: '2026-11-15T10:00:00Z' }])
  })

  it('a server without the routes switches the feature off (null) instead of failing or locking', async () => {
    await backend({})
    expect(await fetchReviewedWeeks(1)).toBeNull()
  })

  it('other failures are errors', async () => {
    await backend({ 'GET /mentor-reviews/me': { status: 500, body: { error: 'server_error', message: 'boom' } } })
    await expect(fetchReviewedWeeks(1)).rejects.toThrow()
  })

  it('sends a review with a session: numeric module id, snake_case, nothing that does not apply', async () => {
    await backend({ 'POST /mentor-reviews': { status: 201, body: {} }, 'GET /mentor-reviews/me': { status: 200, body: [{ module_id: 4, submitted_at: 's' }] } })
    const weeks = await submitReview(1, 900, {
      moduleId: '4',
      hadSession: true,
      topics: ['goals', 'other'],
      otherTopic: 'CV',
      ratings: { clarity: 5, engagement: 4, comfort: 5, time: 3 },
      overall: 4,
      comment: 'Thanks',
    })
    expect(calls[0].body).toEqual({
      module_id: 4,
      had_session: true,
      topics: ['goals', 'other'],
      other_topic: 'CV',
      ratings: { clarity: 5, engagement: 4, comfort: 5, time: 3 },
      overall: 4,
      comment: 'Thanks',
    })
    expect(weeks).toEqual([{ moduleId: '4', submittedAt: 's' }])
  })

  it('sends a review without a session', async () => {
    await backend({ 'POST /mentor-reviews': { status: 201, body: {} }, 'GET /mentor-reviews/me': { status: 200, body: [] } })
    await submitReview(1, 900, { moduleId: '4', hadSession: false, noSessionReason: 'not-scheduled', overall: 2 })
    expect(calls[0].body).toEqual({ module_id: 4, had_session: false, no_session_reason: 'not-scheduled', overall: 2 })
  })

  it('"already sent" (409) counts as sent', async () => {
    await backend({
      'POST /mentor-reviews': { status: 409, body: { error: 'conflict', message: 'already reviewed' } },
      'GET /mentor-reviews/me': { status: 200, body: [{ module_id: 4, submitted_at: 's' }] },
    })
    expect(await submitReview(1, 900, { moduleId: '4', hadSession: false, noSessionReason: 'other', overall: 3 })).toHaveLength(1)
  })
})
