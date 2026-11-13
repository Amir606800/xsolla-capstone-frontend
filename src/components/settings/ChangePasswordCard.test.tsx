import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { NOT_SUPPORTED } from '../../api/password'
import { saveTokens } from '../../api/session'
import { passwordMatches } from '../../mocks/directory'
import { renderWithProviders } from '../../test/renderWithProviders'
import { stubHttp } from '../../test/stubHttp'

vi.setConfig({ testTimeout: 20_000 })

const SAM = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const ADMIN = { id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }
const signIn = (u: object) => localStorage.setItem('auth_user', JSON.stringify(u))
const GOOD = 'Zebra-Quartz-7781'

async function open(route: string) {
  const user = userEvent.setup()
  renderWithProviders(<App />, { route })
  await screen.findByRole('heading', { name: 'Change password' })
  const fill = async (next: string, again: string) => {
    await user.type(screen.getByLabelText('New password'), next)
    await user.type(screen.getByLabelText('New password again'), again)
    await user.click(screen.getByRole('button', { name: 'Change password' }))
  }
  return { fill }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('everyone sets their own new password: no current password, no e-mail', () => {
  it('there is no current-password field, and the new one is checked', async () => {
    signIn(SAM)
    const { fill } = await open('/settings')
    expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument()
    await fill('short', 'other')
    expect(screen.getByText('Use 10 to 72 characters.')).toBeInTheDocument()
    expect(screen.getByText('The two passwords are not the same.')).toBeInTheDocument()
  })

  it('a student: saves in the demo, the form empties, and only the new password works from then on', async () => {
    signIn(SAM)
    const { fill } = await open('/settings')
    await fill(GOOD, GOOD)
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(passwordMatches(1, GOOD)).toBe(true)
    expect(passwordMatches(1, 'anything')).toBe(false)
  })

  it('a lecturer too', async () => {
    signIn({ id: 902, name: 'Elvin Huseynov', email: 'teacher@xsolla.school', roles: ['lecturer'] })
    const { fill } = await open('/settings')
    await fill(GOOD, GOOD)
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
  })

  it('an admin in the demo stays signed in', async () => {
    signIn(ADMIN)
    const { fill } = await open('/admin/settings')
    await fill(GOOD, GOOD)
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
  })

  it('real server, a student: PUT /users/me/password with only the new password; a server without it says so', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const sent: unknown[] = []
    await stubHttp(
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('/users/me/password')) {
          sent.push(JSON.parse(init.body as string))
          return new Response(JSON.stringify({ error: 'forbidden', message: 'forbidden' }), { status: 403 })
        }
        return new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
      }),
    )
    signIn(SAM)
    const { fill } = await open('/settings')
    await fill(GOOD, GOOD)
    expect(await screen.findByText(NOT_SUPPORTED)).toBeInTheDocument()
    expect(sent).toEqual([{ password: GOOD }])
  })

  it('real server, an admin: the existing route with their own id, then signed out to sign in with the new password', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const sent: { path: string; method?: string; body?: unknown }[] = []
    await stubHttp(
      vi.fn(async (url: string, init: RequestInit) => {
        const path = url.replace('https://api.test', '')
        sent.push({ path, method: init.method, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) })
        if (path === '/users/1000/password') return new Response(null, { status: 204 })
        return new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
      }),
    )
    signIn(ADMIN)
    const { fill } = await open('/admin/settings')
    await fill(GOOD, GOOD)
    expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
    expect(screen.getByText('Your password is changed. Sign in with the new one.')).toBeInTheDocument()
    expect(sent.find((c) => c.path === '/users/1000/password')).toMatchObject({ method: 'PUT', body: { password: GOOD } })
  })
})
