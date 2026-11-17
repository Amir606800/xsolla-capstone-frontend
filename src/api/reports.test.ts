import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { deleteReport, fetchOpenReportCount, fetchReports, sendReport, updateReport } from './reports'
import { saveTokens } from './session'

// the real module: these tests check its HTTP calls (test/setup.ts fakes it for everything else)
vi.unmock('./reports')

const BASE = 'https://api.test'
type Call = { method: string; path: string; body?: unknown }
let calls: Call[]

async function backend(answer: (method: string, path: string) => { status: number; body?: unknown }) {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '')
      const method = init.method ?? 'GET'
      calls.push({ method, path, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
      const r = answer(method, path)
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status })
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

const ROW = {
  id: 14,
  subject: 'A student: Murad · Misbehaves in class',
  message: 'About: A student (Murad)\n\nHe interrupts others.',
  status: 'resolved',
  reporter: { id: 7, name: 'Aysel', email: 'aysel@example.com', roles: ['mentor'] },
  admin_note: 'Talked to him.',
  resolved_by: { id: 1, name: 'Admin', email: 'admin@example.com' },
  resolved_at: '2026-11-16T12:00:00Z',
  created_at: '2026-11-16T10:00:00Z',
}

describe('reports on the real backend', () => {
  it('sends a report as subject and message', async () => {
    await backend(() => ({ status: 201, body: { id: 3, subject: 's', message: 'm', created_at: '2026-11-16T10:00:00Z' } }))
    expect(await sendReport('s', 'm')).toEqual({ id: '3', subject: 's', message: 'm', createdAt: '2026-11-16T10:00:00Z' })
    expect(calls[0]).toEqual({ method: 'POST', path: '/reports', body: { subject: 's', message: 'm' } })
  })

  it('lists every report with its sender, note and who resolved it; a deleted sender is null', async () => {
    await backend(() => ({
      status: 200,
      body: [ROW, { ...ROW, id: 15, status: 'open', reporter: null, admin_note: null, resolved_by: null, resolved_at: null }],
    }))
    const [done, open] = (await fetchReports())!
    expect(done).toEqual({
      id: '14',
      subject: ROW.subject,
      message: ROW.message,
      status: 'resolved',
      reporter: { id: 7, name: 'Aysel', email: 'aysel@example.com', roles: ['mentor'] },
      adminNote: 'Talked to him.',
      resolvedBy: { id: 1, name: 'Admin', email: 'admin@example.com' },
      resolvedAt: '2026-11-16T12:00:00Z',
      createdAt: '2026-11-16T10:00:00Z',
    })
    expect(open).toMatchObject({ id: '15', status: 'open', reporter: null })
    expect(open).not.toHaveProperty('adminNote')
  })

  it('a server without the routes: null for the list, 0 open for the sidebar', async () => {
    await backend(() => ({ status: 404, body: { error: 'error', message: '404 page not found' } }))
    expect(await fetchReports()).toBeNull()
    expect(await fetchOpenReportCount()).toBe(0)
  })

  it('counts the open ones from the summary', async () => {
    await backend(() => ({ status: 200, body: { open: 3, resolved: 11, total: 14 } }))
    expect(await fetchOpenReportCount()).toBe(3)
    expect(calls[0].path).toBe('/reports/summary')
  })

  it('resolves with PATCH (only what changes) and deletes with DELETE', async () => {
    await backend((method) => (method === 'PATCH' ? { status: 200, body: ROW } : { status: 204 }))
    expect(await updateReport('14', { status: 'resolved' })).toMatchObject({ id: '14', status: 'resolved' })
    await updateReport('14', { adminNote: '' })
    await deleteReport('14')
    expect(calls).toEqual([
      { method: 'PATCH', path: '/reports/14', body: { status: 'resolved' } },
      { method: 'PATCH', path: '/reports/14', body: { admin_note: '' } },
      { method: 'DELETE', path: '/reports/14', body: undefined },
    ])
  })
})
