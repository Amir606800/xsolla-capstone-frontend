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

describe('in-app notifications: with a backend', () => {
  const dto = (over: object = {}) => ({
    id: 41,
    type: 'enrollment.graded',
    title: 'Grade posted for Week 3: Concurrency',
    message: 'Hi Anna,\n\nMurad posted your grade for Week 3: Concurrency: green.',
    created_at: '2026-11-16T08:00:00Z',
    read_at: null,
    ...over,
  })

  it('GET /notifications: the unread ones from the server, each as one line with the page it opens', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify([dto(), dto({ id: 40, type: 'mentor_slot.booked', title: 'Leyla booked 15:00' }), dto({ id: 39, type: 'something.new' })]), { status: 200 }))
    await stubHttp(fetchSpy)
    const { fetchNotifications } = await real()
    const rows = await fetchNotifications()
    expect((fetchSpy.mock.calls[0] as unknown as [string])[0]).toBe('https://api.test/notifications?limit=100')
    expect(rows.map((n) => [n.id, n.type, n.message, n.link, n.readAt])).toEqual([
      ['41', 'graded', 'Grade posted for Week 3: Concurrency', '/grades', null],
      ['40', 'meeting', 'Leyla booked 15:00', '/calendar', null],
      ['39', 'announcement', 'Grade posted for Week 3: Concurrency', '', null],
    ])
  })

  it('an announcement shows what the admin wrote, not just "Announcement from ...", and opens its page', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const title = 'Announcement from School Admin'
    const announcement = dto({
      id: 7,
      type: 'announcement.created',
      title,
      message: 'Hi Anna,\r\n\r\nNo lectures on Friday.\r\nSee you Monday.\r\n\r\nOpen it in the LMS: /calendar',
    })
    const plain = dto({ id: 6, type: 'announcement.created', title, message: 'Hi Anna,\r\n\r\nHello all.' })
    await stubHttp(vi.fn(async () => new Response(JSON.stringify([announcement, plain]), { status: 200 })))
    const { fetchNotifications } = await real()
    const rows = await fetchNotifications()
    expect(rows.map((n) => [n.type, n.message, n.link])).toEqual([
      ['announcement', 'No lectures on Friday.\nSee you Monday.', '/calendar'],
      ['announcement', 'Hello all.', ''],
    ])
  })

  it('a server with no notification database (503) or no route has no notifications: an empty bell, not an error', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    await stubHttp(vi.fn(async () => new Response(JSON.stringify({ error: 'service_unavailable', message: 'off' }), { status: 503 })))
    const { fetchNotifications } = await real()
    expect(await fetchNotifications()).toEqual([])
    await stubHttp(vi.fn(async () => new Response('null', { status: 200 })))
    expect(await fetchNotifications()).toEqual([])
  })

  it('marking one read is POST /notifications/:id/read; one that is already gone is fine', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
    await stubHttp(fetchSpy)
    const { markNotificationRead } = await real()
    await markNotificationRead('41')
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect([url, init.method]).toEqual(['https://api.test/notifications/41/read', 'POST'])
    await stubHttp(vi.fn(async () => new Response(JSON.stringify({ error: 'not_found', message: 'gone' }), { status: 404 })))
    await expect(markNotificationRead('41')).resolves.toBeUndefined()
  })

  it('"mark all as read" is POST /notifications/read-all', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ marked: 3 }), { status: 200 }))
    await stubHttp(fetchSpy)
    const { markAllNotificationsRead } = await real()
    await markAllNotificationsRead()
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect([url, init.method]).toEqual(['https://api.test/notifications/read-all', 'POST'])
  })
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

