import { afterEach, describe, expect, it, vi } from 'vitest'

// the real ../api/auth is replaced in test/setup.ts; load the real one to test how it picks mock vs backend
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('auth API selection', () => {
  it('uses the offline mock when no backend URL is configured', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { login } = await vi.importActual<typeof import('./auth')>('./auth')
    const user = await login('sam@example.com', 'pw')

    expect(user).toMatchObject({ email: 'sam@example.com', roles: ['student'] })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls the backend when VITE_API_URL is set', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: 'a',
            refresh_token: 'r',
            user: { id: 1, email: 'x@y.co', name: 'X', role: 'teacher' },
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const { login } = await vi.importActual<typeof import('./auth')>('./auth')
    const user = await login('x@y.co', 'pw')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(user.roles).toEqual(['mentor', 'lecturer'])
  })
})
