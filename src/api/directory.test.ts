import { afterEach, describe, expect, it, vi } from 'vitest'
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
    vi.stubGlobal('fetch', fetchSpy)
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
    vi.stubGlobal('fetch', fetchSpy)
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
