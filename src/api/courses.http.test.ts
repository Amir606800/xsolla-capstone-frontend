import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authedRequest } from './authed'
import { fetchModules, submitWork } from './courses.http'
import { getTokens, saveTokens } from './session'

const BASE = 'https://api.test'
type Call = { url: string; init: RequestInit }
let calls: Call[]

/** Answers by "METHOD /path"; anything not listed is a 404. */
function backend(routes: Record<string, (init: RequestInit) => { status: number; body?: unknown }>) {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const key = `${init.method} ${url.replace(BASE, '')}`
      const r = routes[key]?.(init) ?? { status: 404, body: { error: 'not_found', message: 'missing', status: 404 } }
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

const tree = [
  {
    id: '200',
    type: 'section',
    title: 'Week 1',
    position: 1,
    is_visible: true,
    children: [
      { id: '202', type: 'assignment', title: 'Homework 1', position: 1, is_visible: true, due_at: '2026-11-10T23:59:00Z', max_points: 100 },
    ],
  },
]

describe('fetchModules', () => {
  it('lists the courses, loads the first one and sends the bearer token', async () => {
    backend({
      'GET /courses': () => ({ status: 200, body: [{ id: '10', title: 'CS101' }] }),
      'GET /courses/10/content-items': () => ({ status: 200, body: tree }),
    })
    const modules = await fetchModules(false)
    expect(modules).toHaveLength(1)
    expect(modules[0].items[0]).toMatchObject({ id: '202', type: 'assignment', title: 'Homework 1' })
    expect(calls.every((c) => (c.init.headers as Record<string, string>).Authorization === 'Bearer acc')).toBe(true)
    expect(calls).toHaveLength(2) // no per-task requests for teachers
  })

  it('students also get their own submission; a 404 means not handed in', async () => {
    backend({
      'GET /courses': () => ({ status: 200, body: [{ id: '10' }] }),
      'GET /courses/10/content-items': () => ({ status: 200, body: tree }),
      'GET /content-items/202/submissions/me': () => ({
        status: 200,
        body: { id: '400', assignment_id: '202', text_body: 'hi', submitted_at: '2026-11-05T10:00:00Z', feedback: null, graded_at: null },
      }),
    })
    const [m] = await fetchModules(true)
    expect(m.items[0]).toMatchObject({ submission: { textBody: 'hi' } })

    backend({
      'GET /courses': () => ({ status: 200, body: [{ id: '10' }] }),
      'GET /courses/10/content-items': () => ({ status: 200, body: tree }),
    })
    const [m2] = await fetchModules(true)
    expect(m2.items[0]).not.toHaveProperty('submission')
  })

  it('an empty course list gives an empty course', async () => {
    backend({ 'GET /courses': () => ({ status: 200, body: [] }) })
    expect(await fetchModules(true)).toEqual([])
  })
})

describe('submitWork', () => {
  it('uploads each file as multipart (no JSON header), then posts text_body and file_ids', async () => {
    backend({
      'GET /courses': () => ({ status: 200, body: [{ id: '10' }] }),
      'POST /files': () => ({ status: 201, body: { id: '300', original_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 3 } }),
      'POST /courses/10/content-items/202/submissions': () => ({
        status: 201,
        body: { id: '400', assignment_id: '202', text_body: 'done', submitted_at: '2026-11-05T10:00:00Z', feedback: null, graded_at: null },
      }),
    })
    const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' })
    const result = await submitWork('202', { textBody: 'done', files: [file] })

    const upload = calls.find((c) => c.url.endsWith('/files'))!
    expect(upload.init.body).toBeInstanceOf(FormData)
    expect((upload.init.body as FormData).get('file')).toBeInstanceOf(File)
    expect(Object.keys(upload.init.headers as object).map((h) => h.toLowerCase())).not.toContain('content-type')

    const post = calls[calls.length - 1]
    expect(post.init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer acc' })
    expect(JSON.parse(post.init.body as string)).toEqual({ text_body: 'done', file_ids: ['300'] })
    expect(result).toMatchObject({ submittedAt: '2026-11-05T10:00:00Z', textBody: 'done', files: [{ name: 'a.pdf', sizeBytes: 3 }] })
  })

  it('leaves text_body out when there is none', async () => {
    backend({
      'GET /courses': () => ({ status: 200, body: [{ id: '10' }] }),
      'POST /courses/10/content-items/202/submissions': () => ({
        status: 201,
        body: { id: '1', assignment_id: '202', text_body: null, submitted_at: 'x', feedback: null, graded_at: null },
      }),
    })
    await submitWork('202', { textBody: '', files: [] })
    expect(JSON.parse(calls[calls.length - 1].init.body as string)).toEqual({ file_ids: [] })
  })
})

describe('authedRequest', () => {
  it('on 401 refreshes the tokens once and repeats the request', async () => {
    let first = true
    backend({
      'GET /users/me': (init) => {
        const ok = (init.headers as Record<string, string>).Authorization === 'Bearer acc2'
        first = false
        return ok ? { status: 200, body: { id: '1' } } : { status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } }
      },
      'POST /auth/refresh': (init) => {
        expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'ref' })
        return { status: 200, body: { access_token: 'acc2', refresh_token: 'ref2' } }
      },
    })
    await expect(authedRequest('/users/me')).resolves.toEqual({ id: '1' })
    expect(first).toBe(false)
    expect(getTokens()).toEqual({ accessToken: 'acc2', refreshToken: 'ref2' })
  })

  it('when the refresh fails too it signs out and goes to /login', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { pathname: '/dashboard', assign })
    localStorage.setItem('auth_user', '{}')
    backend({
      'GET /users/me': () => ({ status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } }),
      'POST /auth/refresh': () => ({ status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } }),
    })
    await expect(authedRequest('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(getTokens()).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login')
  })
})
