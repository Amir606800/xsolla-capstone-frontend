import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { authedRequest } from './authed'
import { assignLecturer, createModule, deleteItem, deleteModule, fetchModules, saveItem, saveModule, submitWork } from './courses.http'
import { deleteEvent, fetchEvents, saveEvent } from './events.http'
import { getTokens, saveTokens } from './session'

const BASE = 'https://api.test'
type Call = { method: string; path: string; url: string; init: RequestInit }
let calls: Call[]
type Route = (init: RequestInit) => { status: number; body?: unknown }

/** A fake Go backend: answers by "METHOD /path" (query string ignored); anything else is a 404. */
async function backend(routes: Record<string, Route>) {
  calls = []
  await stubHttp(vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '').split('?')[0]
      calls.push({ method: init.method ?? 'GET', path, url, init })
      const r = routes[`${init.method} ${path}`]?.(init) ?? { status: 404, body: { error: 'not_found', message: 'missing', status: 404 } }
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status })
    }),
  )
}
const json = (c: Call) => JSON.parse(c.init.body as string)
const find = (method: string, path: string) => calls.find((c) => c.method === method && c.path === path)!

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', BASE)
  saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// what the backend returns today: numeric ids, modules = weeks, flat content items
const MODULES = { 'GET /modules': () => ({ status: 200, body: [{ id: 4, title: 'Go Basics', description: 'Go', created_by: 9, created_at: '2026-11-01T00:00:00Z' }] }) }
const ITEMS = {
  'GET /modules/4/content-items': () => ({
    status: 200,
    body: [
      { id: 40, type: 'file', title: 'slides.pdf', description: '', position: 1, is_visible: true, file_id: 7 },
      { id: 41, type: 'assignment', title: 'CLI tool', description: '', position: 2, is_visible: true, file_id: null, due_at: '2026-11-09T18:00:00Z' },
    ],
  }),
}

describe('fetchModules', () => {
  it('loads the modules, then each module\'s flat items, with the bearer token', async () => {
    await backend({ ...MODULES, ...ITEMS })
    const [m] = await fetchModules(false)
    expect(m).toMatchObject({ id: '4', position: 1, title: 'Go Basics' })
    expect(m.items.map((i) => [i.id, i.type, i.moduleId])).toEqual([
      ['40', 'resource', '4'],
      ['41', 'assignment', '4'],
    ])
    expect(calls.every((c) => (c.init.headers as Record<string, string>).Authorization === 'Bearer acc')).toBe(true)
    expect(calls).toHaveLength(2) // staff: no per-task requests
  })

  it("students also get their own work from the module's submissions/me; 404 means none", async () => {
    await backend({
      ...MODULES,
      ...ITEMS,
      'GET /modules/4/content-items/41/submissions/me': () => ({
        status: 200,
        body: { id: 9, content_item_id: 41, student_id: 1, text_body: 'repo link', submitted_at: '2026-11-08T10:00:00Z' },
      }),
    })
    const [m] = await fetchModules(true)
    expect(m.items[1]).toMatchObject({ submission: { textBody: 'repo link' } })

    await backend({ ...MODULES, ...ITEMS })
    const [m2] = await fetchModules(true)
    expect(m2.items[1]).not.toHaveProperty('submission')
  })

  it('no modules (not enrolled yet) gives an empty course; null bodies are fine', async () => {
    await backend({ 'GET /modules': () => ({ status: 200, body: null }) })
    expect(await fetchModules(true)).toEqual([])
  })
})

describe('submitWork', () => {
  it('uploads the files as multipart, then posts text_body and NUMERIC file_ids under the module', async () => {
    await backend({
      'POST /files': () => ({ status: 201, body: { id: 300, original_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 3 } }),
      'POST /modules/4/content-items/41/submissions': () => ({
        status: 201,
        body: { id: 9, content_item_id: 41, text_body: 'done', submitted_at: '2026-11-08T10:00:00Z' },
      }),
    })
    const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' })
    const result = await submitWork('4', '41', { textBody: 'done', files: [file] })

    const up = find('POST', '/files')
    expect((up.init.body as FormData).get('file')).toBeInstanceOf(File)
    expect(Object.keys(up.init.headers as object).map((h) => h.toLowerCase())).not.toContain('content-type')

    const post = find('POST', '/modules/4/content-items/41/submissions')
    expect(json(post)).toEqual({ text_body: 'done', file_ids: [300] })
    expect(typeof json(post).file_ids[0]).toBe('number')
    expect(result).toMatchObject({ textBody: 'done', files: [{ name: 'a.pdf', sizeBytes: 3 }] })
  })

  it('files carried over from the current version are sent by id, not uploaded again', async () => {
    await backend({
      'POST /files': () => ({ status: 201, body: { id: 301, original_name: 'new.pdf', mime_type: 'application/pdf', size_bytes: 3 } }),
      'POST /modules/4/content-items/41/submissions': () => ({
        status: 201,
        body: { id: 10, content_item_id: 41, text_body: 'v2', submitted_at: '2026-11-08T11:00:00Z' },
      }),
    })
    const file = new File(['abc'], 'new.pdf', { type: 'application/pdf' })
    const result = await submitWork('4', '41', { textBody: 'v2', files: [file], keep: [{ id: '300', name: 'a.pdf', sizeBytes: 3 }] })
    expect(calls.filter((c) => c.path === '/files')).toHaveLength(1)
    expect(json(find('POST', '/modules/4/content-items/41/submissions'))).toEqual({ text_body: 'v2', file_ids: [300, 301] })
    expect(result.files?.map((f) => f.name)).toEqual(['a.pdf', 'new.pdf'])
  })
})

describe('lecturer editing', () => {
  const reload = { ...MODULES, ...ITEMS }

  it('a new module is POSTed with its title and description and comes back with the server id', async () => {
    await backend({ ...reload, 'POST /modules': () => ({ status: 201, body: { id: 4, title: 'Go Basics', description: 'Go', created_by: 1, created_at: '2026-11-01T00:00:00Z' } }) })
    const { id, modules } = await createModule({ title: 'Go Basics', description: 'Go', opensAt: '2026-11-02T00:00:00Z' })
    // no week dates in the backend: only title and description are sent
    expect(json(find('POST', '/modules'))).toEqual({ title: 'Go Basics', description: 'Go' })
    expect(id).toBe('4')
    expect(modules.map((m) => m.id)).toEqual(['4'])
  })

  it('assigning a lecturer to a week sends lecturer_id and checks the server really changed it', async () => {
    await backend({ ...reload, 'PATCH /modules/4': () => ({ status: 200, body: { id: 4 } }) })
    // the server accepts the request but still says created_by 9: it does not know the field yet
    await expect(assignLecturer('4', 12)).rejects.toThrow('The server cannot change the lecturer of a week yet.')
    expect(json(find('PATCH', '/modules/4'))).toEqual({ lecturer_id: 12 })
    // once the server applies it, created_by follows
    await backend({
      'PATCH /modules/4': () => ({ status: 200, body: { id: 4 } }),
      'GET /modules': () => ({ status: 200, body: [{ id: 4, title: 'Go Basics', description: 'Go', created_by: 12, created_at: '2026-11-01T00:00:00Z' }] }),
      ...ITEMS,
    })
    expect((await assignLecturer('4', 12))[0].createdBy).toBe(12)
  })

  it('taking the lecturer off a week sends null; the server must then report no lecturer', async () => {
    await backend({ ...reload, 'PATCH /modules/4': () => ({ status: 200, body: { id: 4 } }) })
    // this server still reports created_by 9
    await expect(assignLecturer('4', null)).rejects.toThrow('cannot change the lecturer of a week yet')
    expect(json(find('PATCH', '/modules/4'))).toEqual({ lecturer_id: null })
    await backend({
      'PATCH /modules/4': () => ({ status: 200, body: { id: 4 } }),
      'GET /modules': () => ({ status: 200, body: [{ id: 4, title: 'Go Basics', created_at: '2026-11-01T00:00:00Z' }] }),
      ...ITEMS,
    })
    expect((await assignLecturer('4', null))[0].createdBy).toBeUndefined()
  })

  it('an admin deletes a whole module: DELETE /modules/:id, then the course is loaded again', async () => {
    await backend({ ...reload, 'DELETE /modules/4': () => ({ status: 204 }) })
    await deleteModule('4')
    expect(find('DELETE', '/modules/4').init.headers).toMatchObject({ Authorization: 'Bearer acc' })
    expect(calls.map((c) => `${c.method} ${c.path}`).slice(-2)).toEqual(['GET /modules', 'GET /modules/4/content-items'])
  })

  it('a new task is POSTed to its own module with a due date and max_points 0', async () => {
    await backend({ ...reload, 'POST /modules/4/content-items': () => ({ status: 201, body: { id: 42 } }) })
    await saveItem({ id: 'task-ab1', moduleId: '4', type: 'assignment', title: 'HTTP server', requirements: ['Tests'], dueAt: '2026-11-11T18:00:00.000Z' })
    const body = json(find('POST', '/modules/4/content-items'))
    expect(body).toMatchObject({ type: 'assignment', title: 'HTTP server', due_at: '2026-11-11T18:00:00.000Z', max_points: 0 })
    expect(body.description).toContain('Tests')
    expect(calls.some((c) => c.path.includes('/modules/module'))).toBe(false)
  })

  it('an existing task is PATCHed by its id', async () => {
    await backend({ ...reload, 'PATCH /content-items/41': () => ({ status: 200, body: { id: 41 } }) })
    await saveItem({ id: '41', moduleId: '4', type: 'assignment', title: 'CLI tool v2', dueAt: '2026-11-09T18:00:00Z' })
    expect(json(find('PATCH', '/content-items/41'))).toEqual({ title: 'CLI tool v2', description: '' })
  })

  it('a new file material uploads the file, then creates the item with its numeric file_id', async () => {
    await backend({
      ...reload,
      'POST /files': () => ({ status: 201, body: { id: 77, original_name: 'notes.md', mime_type: 'text/markdown', size_bytes: 4 } }),
      'POST /modules/4/content-items': () => ({ status: 201, body: { id: 43 } }),
    })
    const upload = new File(['# hi'], 'notes.md', { type: 'text/markdown' })
    await saveItem({ id: 'material-x', moduleId: '4', type: 'resource', title: 'Notes', kind: 'md', file: { name: 'notes.md', sizeBytes: 4 }, upload })
    expect(json(find('POST', '/modules/4/content-items'))).toMatchObject({ type: 'file', title: 'Notes', file_id: 77 })
  })

  it('links and quizzes have no place in the backend yet: a clear error, nothing sent', async () => {
    backend(reload)
    await expect(saveItem({ id: 'm-1', moduleId: '4', type: 'resource', title: 'Docs', kind: 'link', url: 'https://go.dev' })).rejects.toThrow(/Links cannot be saved/)
    await expect(saveItem({ id: 'q-1', moduleId: '4', type: 'quiz', title: 'Quiz' })).rejects.toThrow(/Quizzes cannot be saved/)
    expect(calls).toHaveLength(0)
  })

  it('module details are PATCHed by module id; deleting an item uses its id', async () => {
    await backend({ ...reload, 'PATCH /modules/4': () => ({ status: 200, body: {} }), 'DELETE /content-items/40': () => ({ status: 204 }) })
    await saveModule('4', { title: 'Go', description: 'Basics' })
    expect(json(find('PATCH', '/modules/4'))).toEqual({ title: 'Go', description: 'Basics' })
    const after = await deleteItem('40')
    expect(find('DELETE', '/content-items/40')).toBeDefined()
    expect(after[0].id).toBe('4')
  })
})

describe('calendar events', () => {
  const LIST = {
    'GET /events': () => ({
      status: 200,
      body: [{ id: 5, title: 'Lecture', kind: 'lecture', starts_at: '2026-11-09T10:00:00Z', ends_at: '2026-11-09T12:00:00Z', all_day: false, location: 'Hall', module_id: 4 }],
    }),
  }

  it('loads the events of a wide window around today', async () => {
    await backend(LIST)
    const [e] = await fetchEvents(new Date('2026-11-06T12:00:00Z'))
    expect(e).toMatchObject({ id: '5', kind: 'lecture', location: 'Hall', moduleId: '4' })
    expect(calls[0].path).toBe('/events')
    expect(calls[0].url).toMatch(/\/events\?from=.+&to=.+/)
  })

  it('creates a new event with POST and edits an existing one with PATCH', async () => {
    await backend({ ...LIST, 'POST /events': () => ({ status: 201, body: {} }), 'PATCH /events/5': () => ({ status: 200, body: {} }) })
    await saveEvent({ id: 'ev-new', title: 'Talk', kind: 'meeting', startsAt: 's', endsAt: 'e', moduleId: '4' })
    expect(json(find('POST', '/events'))).toEqual({ title: 'Talk', kind: 'meeting', starts_at: 's', ends_at: 'e', all_day: false, meeting_url: null, module_id: 4 })
    await saveEvent({ id: '5', title: 'Lecture 2', kind: 'lecture', startsAt: 's', endsAt: 'e' })
    expect(json(find('PATCH', '/events/5'))).toMatchObject({ title: 'Lecture 2' })
  })

  it('deletes by id', async () => {
    await backend({ ...LIST, 'DELETE /events/5': () => ({ status: 204 }) })
    await deleteEvent('5')
    expect(find('DELETE', '/events/5')).toBeDefined()
  })
})

describe('authedRequest', () => {
  it('on 401 refreshes the tokens once and repeats the request', async () => {
    await backend({
      'GET /users/me': (init) =>
        (init.headers as Record<string, string>).Authorization === 'Bearer acc2'
          ? { status: 200, body: { id: 1 } }
          : { status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } },
      'POST /auth/refresh': (init) => {
        expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'ref' })
        return { status: 200, body: { access_token: 'acc2', refresh_token: 'ref2' } }
      },
    })
    await expect(authedRequest('/users/me')).resolves.toEqual({ id: 1 })
    expect(getTokens()).toEqual({ accessToken: 'acc2', refreshToken: 'ref2' })
  })

  it('when the refresh fails too it signs out and goes to /login', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { pathname: '/dashboard', assign })
    localStorage.setItem('auth_user', '{}')
    await backend({
      'GET /users/me': () => ({ status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } }),
      'POST /auth/refresh': () => ({ status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } }),
    })
    await expect(authedRequest('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(getTokens()).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  it('from the admin section it goes to the admin sign-in instead', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { pathname: '/admin', assign })
    await backend({
      'GET /users/me': () => ({ status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } }),
      'POST /auth/refresh': () => ({ status: 401, body: { error: 'unauthorized', message: 'expired', status: 401 } }),
    })
    await expect(authedRequest('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(assign).toHaveBeenCalledWith('/admin/login')
  })
})
