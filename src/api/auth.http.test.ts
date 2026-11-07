import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, logout, mapUser, signup } from './auth.http'
import { ApiError } from './http'
import { getTokens, saveTokens } from './session'

const BASE = 'https://api.test'

const authBody = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  user: { id: 7, email: 'alice@xsolla.com', name: 'Alice', role: 'student', created_at: '2026-01-01T00:00:00Z' },
}

function reply(status: number, body: unknown) {
  return vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', `${BASE}/`) // trailing slash must not double up
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function mockFetch(status: number, body?: unknown) {
  fetchMock = reply(status, body)
  vi.stubGlobal('fetch', fetchMock)
}

describe('login', () => {
  it('posts { login, password } to /auth/login as JSON', async () => {
    mockFetch(200, authBody)
    await login('alice@xsolla.com', 'secret123')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/auth/login`)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual({ login: 'alice@xsolla.com', password: 'secret123' })
  })

  it('returns the user for the app and stores both tokens', async () => {
    mockFetch(200, authBody)
    const user = await login('alice@xsolla.com', 'secret123')

    expect(user).toEqual({ id: 7, name: 'Alice', email: 'alice@xsolla.com', roles: ['student'] })
    expect(getTokens()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' })
  })

  it('does not send a custom header that the backend CORS rules would reject', async () => {
    mockFetch(200, authBody)
    await login('a@b.co', 'x')
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const names = Object.keys(init.headers as Record<string, string>).map((h) => h.toLowerCase())
    expect(names.every((n) => ['content-type', 'accept', 'authorization'].includes(n))).toBe(true)
  })

  it('turns the backend error into an ApiError with a readable message', async () => {
    mockFetch(401, { error: 'invalid_credentials', message: 'invalid email or password', status: 401 })
    const err = await login('a@b.co', 'wrong').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 401, code: 'invalid_credentials', message: 'Invalid email or password' })
    expect(getTokens()).toBeNull()
  })

  it('shows field messages from a 400 response', async () => {
    mockFetch(400, {
      error: 'validation_error',
      message: 'invalid request',
      status: 400,
      details: [
        { field: 'login', message: 'login is required' },
        { field: 'password', message: 'password is required' },
      ],
    })
    await expect(login('', '')).rejects.toThrow('Login is required. password is required')
  })

  it('reports an unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const err = await login('a@b.co', 'x').catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 0, code: 'network_error' })
    expect((err as Error).message).toMatch(/can't reach the server/i)
  })

  it('copes with a non-JSON error page (e.g. a proxy)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    await expect(login('a@b.co', 'x')).rejects.toMatchObject({ status: 502, message: 'Something went wrong' })
  })
})

describe('signup', () => {
  it('posts email, name and password, then signs the user in', async () => {
    mockFetch(200, authBody)
    const user = await signup('alice@xsolla.com', 'Alice', 'secret123')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/auth/signup`)
    expect(JSON.parse(init.body as string)).toEqual({ email: 'alice@xsolla.com', name: 'Alice', password: 'secret123' })
    expect(user.name).toBe('Alice')
    expect(getTokens()?.accessToken).toBe('access-1')
  })
})

describe('logout', () => {
  it('sends the refresh token, then forgets the tokens', async () => {
    saveTokens({ accessToken: 'a', refreshToken: 'r' })
    mockFetch(204)
    await logout()

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/auth/logout`)
    expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'r' })
    expect(init.headers).toMatchObject({ Authorization: 'Bearer a' })
    expect(getTokens()).toBeNull()
  })

  it('still signs out on this device when the server fails', async () => {
    saveTokens({ accessToken: 'a', refreshToken: 'r' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(logout()).resolves.toBeUndefined()
    expect(getTokens()).toBeNull()
  })

  it('does not call the server when nobody was signed in', async () => {
    mockFetch(204)
    await logout()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('mapUser: roles given for a while', () => {
  it('reads role_expires_at (planned) into roleUntil', () => {
    const u = mapUser({ id: 9, email: 'r@x', name: 'R', roles: ['mentor', 'lecturer'], role_expires_at: { lecturer: '2026-12-01T00:00:00Z', mentor: null } })
    expect(u).toMatchObject({ roles: ['mentor', 'lecturer'], roleUntil: { lecturer: '2026-12-01T00:00:00Z' } })
    expect(mapUser({ id: 9, email: 'r@x', name: 'R', roles: ['mentor'] })).not.toHaveProperty('roleUntil')
  })
})

describe('mapUser', () => {
  it('reads the backend role into the role set ("teacher" = mentor + lecturer)', () => {
    expect(mapUser({ id: 1, email: 'a', name: 'A', role: 'student' }).roles).toEqual(['student'])
    expect(mapUser({ id: 1, email: 'a', name: 'A', role: 'teacher' }).roles).toEqual(['mentor', 'lecturer'])
    expect(mapUser({ id: 1, email: 'a', name: 'A', role: 'ADMIN' }).roles).toEqual(['admin'])
  })

  it('prefers a roles list when the backend sends one', () => {
    expect(mapUser({ id: 1, email: 'a', name: 'A', role: 'teacher', roles: ['mentor'] }).roles).toEqual(['mentor'])
  })

  it('gives an unknown role the least access (student)', () => {
    expect(mapUser({ id: 1, email: 'a', name: 'A', role: 'superuser' }).roles).toEqual(['student'])
  })

  it('accepts string ids, as in API_CONTRACT.md', () => {
    expect(mapUser({ id: '12', email: 'x@y.co', name: 'X', role: 'student' }).id).toBe(12)
  })

  it('maps the user and drops fields the UI does not use', () => {
    expect(mapUser({ id: 3, email: 'x@y.co', name: 'X', role: 'teacher', created_at: 'now' })).toEqual({
      id: 3,
      email: 'x@y.co',
      name: 'X',
      roles: ['mentor', 'lecturer'],
    })
  })
})
