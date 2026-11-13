import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { connectUrl, disconnect, fetchCalendarEvents, fetchStatus } from './google.http'
import { saveEvent } from './events.http'
import { getTokens, saveTokens } from './session'

const BASE = 'https://api.test'
type Call = { method: string; path: string; url: string; init: RequestInit }
let calls: Call[]
type Route = (init: RequestInit) => { status: number; body?: unknown }

/** A fake Go backend: answers by "METHOD /path" (query string ignored); anything else is a 404. */
async function backend(routes: Record<string, Route>) {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '').split('?')[0]
      calls.push({ method: init.method ?? 'GET', path, url, init })
      const r = routes[`${init.method} ${path}`]?.(init) ?? { status: 404, body: { error: 'not_found', message: 'missing', status: 404 } }
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status })
    }),
  )
}
const json = (c: Call) => JSON.parse(c.init.body as string)
const find = (method: string, path: string) => calls.find((c) => c.method === method && c.path === path)!
const err = (status: number, error: string, message = error) => () => ({ status, body: { error, message, status } })

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', BASE)
  saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const REFRESH = { 'POST /auth/refresh': () => ({ status: 200, body: { access_token: 'acc2', refresh_token: 'ref2' } }) }

describe('the Google connection status (GET /auth/google/me)', () => {
  it('is connected, with the account, when the server returns the profile', async () => {
    await backend({
      'GET /auth/google/me': () => ({ status: 200, body: { id: '1', email: 'sam@gmail.com', name: 'Sam T', picture: 'https://lh3.test/a.png', verified_email: true } }),
    })
    expect(await fetchStatus()).toEqual({ connection: 'connected', account: { email: 'sam@gmail.com', name: 'Sam T', picture: 'https://lh3.test/a.png' } })
    expect((find('GET', '/auth/google/me').init.headers as Record<string, string>).Authorization).toBe('Bearer acc')
  })

  it('falls back to the address when the profile has no name', async () => {
    await backend({ 'GET /auth/google/me': () => ({ status: 200, body: { email: 'sam@gmail.com' } }) })
    expect((await fetchStatus()).account).toEqual({ email: 'sam@gmail.com', name: 'sam@gmail.com' })
  })

  it('is disconnected on 404 google_not_connected', async () => {
    await backend({ 'GET /auth/google/me': err(404, 'google_not_connected', 'Google account not connected') })
    expect(await fetchStatus()).toEqual({ connection: 'disconnected' })
  })

  it('needs a reconnect on 401 google_token_expired (after the login itself was renewed)', async () => {
    await backend({ ...REFRESH, 'GET /auth/google/me': err(401, 'google_token_expired') })
    expect(await fetchStatus()).toEqual({ connection: 'reconnect' })
  })

  it('is unavailable when Google or the server cannot be reached (502, 500)', async () => {
    await backend({ 'GET /auth/google/me': err(502, 'upstream_error') })
    expect(await fetchStatus()).toEqual({ connection: 'unavailable' })
    await backend({ 'GET /auth/google/me': err(500, 'server_error') })
    expect(await fetchStatus()).toEqual({ connection: 'unavailable' })
  })

  it('is unsupported on a server that has no such route', async () => {
    await backend({})
    expect(await fetchStatus()).toEqual({ connection: 'unsupported' })
    await backend({ 'GET /auth/google/me': err(405, 'method_not_allowed') })
    expect(await fetchStatus()).toEqual({ connection: 'unsupported' })
  })
})

describe('the Connect link (GET /auth/google/login)', () => {
  it('carries a freshly renewed access token in the query, as a page navigation cannot send headers', async () => {
    await backend(REFRESH)
    expect(await connectUrl()).toBe(`${BASE}/auth/google/login?access_token=acc2`)
    expect(getTokens()?.accessToken).toBe('acc2')
  })

  it('uses the token it has when renewing fails', async () => {
    await backend({ 'POST /auth/refresh': err(401, 'invalid_credentials') })
    expect(await connectUrl()).toBe(`${BASE}/auth/google/login?access_token=acc`)
  })

  it('refuses when nobody is signed in', async () => {
    await backend({})
    localStorage.clear()
    await expect(connectUrl()).rejects.toMatchObject({ status: 401 })
  })
})

describe('saving an event with sync_to_google', () => {
  const LIST = { 'GET /events': () => ({ status: 200, body: [] }) }
  const draft = { id: 'ev-new', title: 'Talk', kind: 'lecture' as const, startsAt: 's', endsAt: 'e' }

  it('asks for the Google copy on a new event and reports synced when the row has a google_event_id', async () => {
    await backend({ ...LIST, 'POST /events': () => ({ status: 201, body: { id: 7, google_event_id: 'g123' } }) })
    const r = await saveEvent(draft, { syncToGoogle: true })
    expect(json(find('POST', '/events')).sync_to_google).toBe(true)
    expect(r.google).toBe('synced')
  })

  it('reports failed when it was asked for but the created row has no google_event_id (the server hides that failure)', async () => {
    await backend({ ...LIST, 'POST /events': () => ({ status: 201, body: { id: 7 } }) })
    expect((await saveEvent(draft, { syncToGoogle: true })).google).toBe('failed')
  })

  it('sends nothing about Google when it was not asked for', async () => {
    await backend({ ...LIST, 'POST /events': () => ({ status: 201, body: { id: 7, google_event_id: 'g' } }) })
    const r = await saveEvent(draft)
    expect('sync_to_google' in json(find('POST', '/events'))).toBe(false)
    expect(r.google).toBe('not-asked')
  })

  it('never sends it when editing: the server cannot add the Google copy later', async () => {
    await backend({ ...LIST, 'PATCH /events/5': () => ({ status: 200, body: { id: 5 } }) })
    const r = await saveEvent({ ...draft, id: '5' }, { syncToGoogle: true })
    expect('sync_to_google' in json(find('PATCH', '/events/5'))).toBe(false)
    expect(r.google).toBe('not-asked')
  })
})

describe('the person’s own Google events (GET /google/calendar/events)', () => {
  const from = new Date('2026-07-15T00:00:00Z')
  const to = new Date('2027-03-12T00:00:00Z')

  it('asks once for the window with the token and maps the events (all-day as local dates)', async () => {
    await backend({
      'GET /google/calendar/events': () => ({
        status: 200,
        body: [
          { id: 'a', title: 'Dentist', starts_at: '2026-11-20T10:00:00+04:00', ends_at: '2026-11-20T11:00:00+04:00', all_day: false },
          { id: 'b', title: 'Birthday', starts_at: '2026-11-20', ends_at: '2026-11-20', all_day: true },
        ],
      }),
    })
    const result = await fetchCalendarEvents(from, to)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain(`from=${encodeURIComponent(from.toISOString())}`)
    expect(calls[0].url).toContain(`to=${encodeURIComponent(to.toISOString())}`)
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer acc' })
    expect(result.state).toBe('ok')
    if (result.state === 'ok') expect(result.events.map((e) => [e.id, e.kind, !!e.allDay])).toEqual([['google-a', 'google', false], ['google-b', 'google', true]])
  })

  it('an empty answer (null) is no events', async () => {
    await backend({ 'GET /google/calendar/events': () => ({ status: 200, body: null }) })
    expect(await fetchCalendarEvents(from, to)).toEqual({ state: 'ok', events: [] })
  })

  it('a revoked Google token says reconnect; a server without the route says unsupported', async () => {
    await backend({ ...REFRESH, 'GET /google/calendar/events': err(401, 'google_token_expired') })
    expect(await fetchCalendarEvents(from, to)).toEqual({ state: 'reconnect' })
    await backend({ 'GET /google/calendar/events': err(404, 'not_found') })
    expect(await fetchCalendarEvents(from, to)).toEqual({ state: 'unsupported' })
    await backend({ 'GET /google/calendar/events': err(405, 'method_not_allowed') })
    expect(await fetchCalendarEvents(from, to)).toEqual({ state: 'unsupported' })
  })

  it('Google being down (502) or a server problem (500) is an error for the page to show quietly', async () => {
    await backend({ 'GET /google/calendar/events': err(502, 'upstream_error') })
    await expect(fetchCalendarEvents(from, to)).rejects.toMatchObject({ status: 502 })
    await backend({ 'GET /google/calendar/events': err(500, 'server_error') })
    await expect(fetchCalendarEvents(from, to)).rejects.toMatchObject({ status: 500 })
  })
})

describe('disconnecting Google (POST /auth/google/logout)', () => {
  it('posts with the token and is done on 204', async () => {
    await backend({ 'POST /auth/google/logout': () => ({ status: 204 }) })
    await expect(disconnect()).resolves.toBeUndefined()
    expect(find('POST', '/auth/google/logout').init.headers).toMatchObject({ Authorization: 'Bearer acc' })
  })

  it('a server without the route says so in words; a server error stays an error', async () => {
    await backend({ 'POST /auth/google/logout': err(404, 'not_found') })
    await expect(disconnect()).rejects.toThrow(/cannot disconnect Google yet/)
    await backend({ 'POST /auth/google/logout': err(500, 'server_error', 'could not disconnect Google account') })
    await expect(disconnect()).rejects.toMatchObject({ status: 500 })
  })
})
