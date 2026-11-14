import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { LECTURE_FORM } from '../utils/lectureFeedback'
import { fetchLectureForm, fetchPendingLectures, mapPending, mapQuestion, sendLectureFeedback } from './lectureFeedback'
import { saveTokens } from './session'

// the shared test setup replaces this module with the demo store; here the real one is under test
vi.unmock('./lectureFeedback')

const BASE = 'https://api.test'
let calls: { method: string; path: string; body?: unknown }[]

async function backend(routes: Record<string, { status: number; body?: unknown }>) {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '')
      calls.push({ method: init.method ?? 'GET', path, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) })
      const r = routes[`${init.method ?? 'GET'} ${path}`]
      return r
        ? new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status })
        : new Response('404 page not found', { status: 404 })
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

const PENDING = {
  event_id: 41,
  title: 'Goroutines',
  starts_at: '2026-11-12T15:00:00Z',
  ends_at: '2026-11-12T17:00:00Z',
  module_id: 3,
  module_title: 'Week 3: Concurrency',
  closes_at: '2026-11-19T17:00:00Z',
}

describe('the form', () => {
  it('draws the server’s questions, in its order', async () => {
    await backend({
      'GET /lecture-feedback/form': {
        status: 200,
        body: [
          { id: 'overall', type: 'scale', label: 'Overall?', required: true, min_label: 'Bad', max_label: 'Good' },
          { id: 'pace', type: 'choice', label: 'Pace?', required: true, options: [{ value: 'too_slow', label: 'Too slow' }] },
          { id: 'liked', type: 'text', label: 'Liked?', required: false, max_length: 500 },
        ],
      },
    })
    expect(await fetchLectureForm()).toEqual([
      { id: 'overall', type: 'scale', label: 'Overall?', required: true, minLabel: 'Bad', maxLabel: 'Good' },
      { id: 'pace', type: 'choice', label: 'Pace?', required: true, options: [{ value: 'too_slow', label: 'Too slow' }] },
      { id: 'liked', type: 'text', label: 'Liked?', required: false, maxLength: 500 },
    ])
  })

  it('falls back to the built-in copy when the server cannot send it', async () => {
    await backend({})
    expect(await fetchLectureForm()).toEqual(LECTURE_FORM)
  })

  it('leaves out a kind of question it cannot draw', () => {
    expect(mapQuestion({ id: 'x', type: 'video', label: '?' })).toBeNull()
    expect(mapQuestion({ id: 'x', type: 'choice', label: '?' })).toBeNull()
  })
})

describe('the lectures to rate', () => {
  it('reads GET /lecture-feedback/pending (ids as text, camelCase)', async () => {
    await backend({ 'GET /lecture-feedback/pending': { status: 200, body: [PENDING] } })
    expect(await fetchPendingLectures(1)).toEqual([mapPending(PENDING)])
    expect(mapPending(PENDING)).toEqual({
      eventId: '41',
      title: 'Goroutines',
      startsAt: '2026-11-12T15:00:00Z',
      endsAt: '2026-11-12T17:00:00Z',
      moduleId: '3',
      moduleTitle: 'Week 3: Concurrency',
      closesAt: '2026-11-19T17:00:00Z',
    })
  })

  it('a lecture without a week has no module', () => {
    expect(mapPending({ ...PENDING, module_id: null, module_title: null })).not.toHaveProperty('moduleId')
  })

  it('a server without the route, or an account that is not only a student (403), means nothing to rate (null)', async () => {
    await backend({})
    expect(await fetchPendingLectures(1)).toBeNull()
    await backend({ 'GET /lecture-feedback/pending': { status: 403, body: { error: 'forbidden', message: 'only students' } } })
    expect(await fetchPendingLectures(1)).toBeNull()
  })

  it('other failures are errors', async () => {
    await backend({ 'GET /lecture-feedback/pending': { status: 500, body: { error: 'server_error', message: 'boom' } } })
    await expect(fetchPendingLectures(1)).rejects.toThrow()
  })
})

describe('sending', () => {
  it('posts the event id as a number with the answers; empty text is not sent', async () => {
    await backend({ 'POST /lecture-feedback': { status: 201, body: { event_id: 41, submitted_at: 's' } } })
    await sendLectureFeedback(1, '41', LECTURE_FORM, {
      overall: 4,
      clarity: 5,
      practice: 3,
      pace: 'too_fast',
      confidence: 2,
      liked: ' The live coding ',
      improve: '  ',
    })
    expect(calls[0].body).toEqual({
      event_id: 41,
      overall: 4,
      clarity: 5,
      practice: 3,
      pace: 'too_fast',
      confidence: 2,
      liked: 'The live coding',
    })
  })

  it('"already sent" (409) counts as sent', async () => {
    await backend({ 'POST /lecture-feedback': { status: 409, body: { error: 'already_sent', message: 'already sent' } } })
    await expect(sendLectureFeedback(1, '41', LECTURE_FORM, { overall: 4 })).resolves.toBeUndefined()
  })

  it('a refusal (the form closed, 422) rejects with the server’s own words', async () => {
    await backend({
      'POST /lecture-feedback': {
        status: 422,
        body: { error: 'validation_failed', message: 'feedback for this lecture is closed: it closed on Thursday' },
      },
    })
    await expect(sendLectureFeedback(1, '41', LECTURE_FORM, { overall: 4 })).rejects.toThrow(/closed/)
  })
})
