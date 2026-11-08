import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { saveTokens } from './session'

// test/setup.ts swaps ./notifications for instant stubs; the real one is tested here
const real = () => vi.importActual<typeof import('./notifications')>('./notifications')

beforeEach(() => saveTokens({ accessToken: 'acc', refreshToken: 'ref' }))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('announcements: with a backend', () => {
  const row = { id: 7, message: 'No classes on Friday.', link: '/calendar', audience: 'students', sent_at: '2026-11-07T10:00:00Z', sent_by: 'School Admin', recipients: 29 }

  it('POST /notifications/broadcast with the message, link and audience', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(row), { status: 201 }))
    await stubHttp(fetchSpy)
    const { sendBroadcast } = await real()

    const sent = await sendBroadcast({ message: '  No classes on Friday. ', link: '/calendar', audience: 'students' }, 'School Admin')
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/notifications/broadcast')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer acc')
    expect(JSON.parse(init.body as string)).toEqual({ message: 'No classes on Friday.', link: '/calendar', audience: 'students' })
    expect(sent).toEqual({ id: '7', message: 'No classes on Friday.', link: '/calendar', audience: 'students', sentAt: '2026-11-07T10:00:00Z', sentBy: 'School Admin', recipients: 29 })
  })

  it('GET /notifications/broadcasts: newest first, an empty list when none', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const older = { ...row, id: 6, sent_at: '2026-11-01T10:00:00Z', link: null }
    await stubHttp(vi.fn(async () => new Response(JSON.stringify([older, row]), { status: 200 })))
    const { fetchBroadcasts } = await real()
    expect((await fetchBroadcasts()).map((b) => [b.id, b.link])).toEqual([['7', '/calendar'], ['6', '']])

    await stubHttp(vi.fn(async () => new Response('null', { status: 200 })))
    expect(await fetchBroadcasts()).toEqual([])
  })

  it('the bell gets announcements from the normal notification list, so nothing extra is fetched', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const fetchSpy = vi.fn()
    await stubHttp(fetchSpy)
    const { fetchAnnouncements } = await real()
    expect(await fetchAnnouncements({ id: 1, roles: ['student'] })).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('announcements: offline', () => {
  it('sending counts the people it reaches from the demo directory', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { sendBroadcast, fetchBroadcasts, fetchAnnouncements } = await real()
    const sent = await sendBroadcast({ message: 'Hi students', link: '', audience: 'students' }, 'School Admin')
    expect(sent.recipients).toBe(29)
    expect((await fetchBroadcasts()).map((b) => b.id)).toEqual([sent.id])
    expect((await fetchAnnouncements({ id: 1, roles: ['student'] })).map((n) => n.message)).toEqual(['Hi students'])
  })
})
