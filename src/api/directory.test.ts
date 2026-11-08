import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { saveTokens } from './session'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('directory API', () => {
  it('offline: the mock cohort, without calling the network', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const fetchSpy = vi.fn()
    await stubHttp(fetchSpy)
    const { fetchTeams, fetchUsers, teamsAreDemoData } = await import('./directory')
    expect((await fetchUsers()).length).toBeGreaterThan(29)
    expect(await fetchTeams()).toHaveLength(6)
    expect(teamsAreDemoData()).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('with a backend: GET /users?search= with the token, mapped to the app’s roles', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { id: '2', email: 'b@x.co', name: 'Bob', role: 'teacher' },
            { id: '1', email: 'a@x.co', name: 'Ann', role: 'student' },
          ]),
          { status: 200 },
        ),
    )
    await stubHttp(fetchSpy)
    const { fetchUsers, teamsAreDemoData } = await import('./directory')

    expect(await fetchUsers()).toEqual([
      { id: 1, name: 'Ann', email: 'a@x.co', roles: ['student'] },
      { id: 2, name: 'Bob', email: 'b@x.co', roles: ['mentor', 'lecturer'] },
    ])
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/users?search=')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer acc')
    // teams still come from the mock, and the admin is told so
    expect(teamsAreDemoData()).toBe(true)
  })
})

describe('adding a student', () => {
  const input = { name: 'Ann Lee', email: 'ann@x.co', password: 'Kp7mWz4qTx', teamId: 't2' }

  it('offline: added to the demo directory and to the chosen team', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { createStudent, fetchTeams, fetchUsers } = await import('./directory')
    const ann = await createStudent(input)
    expect(ann).toMatchObject({ name: 'Ann Lee', email: 'ann@x.co', roles: ['student'] })
    expect((await fetchUsers()).some((u) => u.id === ann.id)).toBe(true)
    expect((await fetchTeams()).find((t) => t.id === 't2')!.studentIds).toContain(ann.id)
  })

  it('with a backend: POST /auth/signup with the chosen password; the admin keeps their own session', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'admin-acc', refreshToken: 'admin-ref' })
    const fetchSpy = vi.fn(async (url: string) =>
      url.endsWith('/auth/signup')
        ? new Response(
            JSON.stringify({ access_token: 'ann-acc', refresh_token: 'ann-ref', user: { id: '41', email: 'ann@x.co', name: 'Ann Lee', role: 'student' } }),
            { status: 201 },
          )
        : new Response(null, { status: 204 }),
    )
    await stubHttp(fetchSpy)
    const { createStudent } = await import('./directory')
    const { getTokens } = await import('./session')

    expect(await createStudent(input)).toEqual({ id: 41, name: 'Ann Lee', email: 'ann@x.co', roles: ['student'] })
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/auth/signup')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'ann@x.co', name: 'Ann Lee', password: 'Kp7mWz4qTx' })
    // the admin is still the one signed in
    expect(getTokens()).toEqual({ accessToken: 'admin-acc', refreshToken: 'admin-ref' })
    // and the session signup opened for Ann is closed
    await vi.waitFor(() => expect(fetchSpy.mock.calls.some(([u]) => String(u).endsWith('/auth/logout'))).toBe(true))
    const logout = fetchSpy.mock.calls.find(([u]) => String(u).endsWith('/auth/logout')) as unknown as [string, RequestInit]
    expect(JSON.parse(logout[1].body as string)).toEqual({ refresh_token: 'ann-ref' })
  })

  it('with a backend: edit, left the school and delete use the proposed routes', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: 41 }), { status: 200 }))
    await stubHttp(fetchSpy)
    const { deleteStudent, setStudentLeft, updateStudent } = await import('./directory')
    await updateStudent(41, { name: 'Ann Lee', email: 'ann@x.co', teamId: null })
    await setStudentLeft(41, true)
    await deleteStudent(41)
    const sent = (fetchSpy.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => [init.method, url, init.body ? JSON.parse(init.body as string) : undefined])
    expect(sent).toEqual([
      ['PATCH', 'https://api.test/users/41', { name: 'Ann Lee', email: 'ann@x.co' }],
      ['PATCH', 'https://api.test/users/41', { active: false }],
      ['DELETE', 'https://api.test/users/41', undefined],
    ])
  })

  it('with a backend that does not have those routes yet: a plain message', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    await stubHttp(vi.fn(async () => new Response('404 page not found', { status: 404 })))
    const { deleteStudent, setStudentLeft, updateStudent } = await import('./directory')
    await expect(updateStudent(41, { name: 'A', email: 'a@x.co', teamId: null })).rejects.toThrow('The server cannot change accounts yet.')
    await expect(setStudentLeft(41, true)).rejects.toThrow('The server cannot mark students as left yet.')
    await expect(deleteStudent(41)).rejects.toThrow('The server cannot delete accounts yet.')
  })

  it('with a backend: a new mentor is POST /users with the mentor role; roles go to PUT /users/:id/roles', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: '77', email: 'nil@x.co', name: 'Nil Ay', roles: ['mentor'] }), { status: 201 }))
    await stubHttp(fetchSpy)
    const { createMentor, setUserRoles } = await import('./directory')
    expect(await createMentor({ name: 'Nil Ay', email: 'nil@x.co', password: 'Kp7mWz4qTx', teamId: null })).toMatchObject({ id: 77, roles: ['mentor'] })
    await setUserRoles(77, ['mentor', 'lecturer'], { lecturer: '2026-12-01T23:59:59.000Z' })
    const sent = (fetchSpy.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => [init.method, url, JSON.parse(init.body as string)])
    expect(sent).toEqual([
      ['POST', 'https://api.test/users', { email: 'nil@x.co', name: 'Nil Ay', password: 'Kp7mWz4qTx', roles: ['mentor'] }],
      ['PUT', 'https://api.test/users/77/roles', { roles: ['mentor', 'lecturer'], expires_at: { lecturer: '2026-12-01T23:59:59.000Z' } }],
    ])
  })

  it('with a backend: a new lecturer is POST /users with the lecturer role only', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: '78', email: 'lec@x.co', name: 'Lea Lec', roles: ['lecturer'] }), { status: 201 }))
    await stubHttp(fetchSpy)
    const { createStaff } = await import('./directory')
    expect(await createStaff({ name: 'Lea Lec', email: 'lec@x.co', password: 'Kp7mWz4qTx', teamId: 't1' }, 'lecturer')).toMatchObject({ id: 78, roles: ['lecturer'] })
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).roles).toEqual(['lecturer'])
  })

  it('offline: a new lecturer has the lecturer role and no team', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { createStaff, fetchTeams } = await import('./directory')
    const lea = await createStaff({ name: 'Lea Lec', email: 'lea@x.co', password: 'Kp7mWz4qTx', teamId: 't1' }, 'lecturer')
    expect(lea.roles).toEqual(['lecturer'])
    expect((await fetchTeams()).some((t) => t.mentorId === lea.id)).toBe(false)
  })

  it('with a backend that cannot do it yet: plain messages for mentors and roles', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    await stubHttp(vi.fn(async () => new Response('404 page not found', { status: 404 })))
    const { createMentor, setUserRoles } = await import('./directory')
    await expect(createMentor({ name: 'Nil Ay', email: 'nil@x.co', password: 'Kp7mWz4qTx', teamId: null })).rejects.toThrow('The server cannot create mentor accounts yet.')
    await expect(setUserRoles(77, ['mentor'])).rejects.toThrow('The server cannot change roles yet.')
    await expect(setUserRoles(77, [])).rejects.toThrow('Keep at least one role.')
  })

  it('with a backend: an e-mail that is taken (409) says so in plain words', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    await stubHttp(vi.fn(async () => new Response(JSON.stringify({ error: 'conflict', message: 'email exists', status: 409 }), { status: 409 })))
    const { createStudent } = await import('./directory')
    await expect(createStudent(input)).rejects.toThrow('There is already an account with this email.')
  })
})

describe('main role and password reset', () => {
  it('with a backend: main_role from the user list becomes the main role', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const rows = [
      { id: '5', email: 'l@x.co', name: 'Lee', roles: ['lecturer', 'mentor'], main_role: 'lecturer' },
      { id: '6', email: 'm@x.co', name: 'Max', roles: ['mentor'], main_role: 'nonsense' },
    ]
    await stubHttp(vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })))
    const { fetchUsers } = await import('./directory')
    const [lee, max] = await fetchUsers()
    expect(lee).toMatchObject({ id: 5, roles: ['mentor', 'lecturer'], mainRole: 'lecturer' })
    expect(max.mainRole).toBeUndefined()
  })

  it('with a backend: PUT /users/:id/password with the new password', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
    await stubHttp(fetchSpy)
    const { resetPassword } = await import('./directory')
    await resetPassword(901, 'Fresh-Start-7q')
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/users/901/password')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer acc')
    expect(JSON.parse(init.body as string)).toEqual({ password: 'Fresh-Start-7q' })
  })

  it('with a backend that cannot do it yet: a plain message; a short password is never sent', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const fetchSpy = vi.fn(async () => new Response('{"error":"not found"}', { status: 404 }))
    await stubHttp(fetchSpy)
    const { resetPassword } = await import('./directory')
    await expect(resetPassword(901, 'Fresh-Start-7q')).rejects.toThrow('The server cannot reset passwords yet.')
    fetchSpy.mockClear()
    await expect(resetPassword(901, 'short')).rejects.toThrow('Use 10 to 72 characters.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('offline: the new password is the only one that signs them in', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { resetPassword } = await import('./directory')
    const { passwordMatches } = await import('../mocks/directory')
    await resetPassword(902, 'Teach-Again-4k')
    expect(passwordMatches(902, 'Teach-Again-4k')).toBe(true)
    expect(passwordMatches(902, 'demo')).toBe(false)
  })
})
