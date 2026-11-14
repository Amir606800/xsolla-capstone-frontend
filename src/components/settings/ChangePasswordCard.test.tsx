import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { NOT_SUPPORTED, WRONG_CURRENT } from '../../api/password'
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
  const fill = async (next: string, again: string, current = 'Old-Password-1') => {
    await user.type(screen.getByLabelText('Current password'), current)
    await user.type(screen.getByLabelText('New password', { exact: true }), next)
    await user.type(screen.getByLabelText('New password again'), again)
    await user.click(screen.getByRole('button', { name: 'Change password' }))
  }
  return { fill }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('everyone changes their own password with the current one', () => {
  it('asks for the current password, and the new one is checked', async () => {
    signIn(SAM)
    const { fill } = await open('/settings')
    expect(screen.getByLabelText('Current password')).toBeInTheDocument()
    await fill('short', 'other', 'x')
    expect(screen.getByText('Use 10 to 72 characters.')).toBeInTheDocument()
    expect(screen.getByText('The two passwords are not the same.')).toBeInTheDocument()
  })

  it('the current password is required, and the new one has to be different', async () => {
    signIn(SAM)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/settings' })
    await screen.findByRole('heading', { name: 'Change password' })
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('Enter your current password.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Current password'), GOOD)
    await user.type(screen.getByLabelText('New password', { exact: true }), GOOD)
    expect(screen.getByText('The new password must be different from the current one.')).toBeInTheDocument()
  })

  it('a student: saves in the demo, the form empties, and only the new password works from then on', async () => {
    signIn(SAM)
    const { fill } = await open('/settings')
    await fill(GOOD, GOOD)
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
    expect(screen.getByLabelText('New password', { exact: true })).toHaveValue('')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(passwordMatches(1, GOOD)).toBe(true)
    expect(passwordMatches(1, 'anything')).toBe(false)
  })

  it('in the demo a wrong current password is refused, and nothing changes', async () => {
    signIn(SAM)
    const { fill } = await open('/settings')
    await fill(GOOD, GOOD) // first: the demo accepts any current password until one is set
    await screen.findByRole('status')
    await fill('Another-Pass-9921', 'Another-Pass-9921', 'not-the-one')
    expect(await screen.findByRole('alert')).toHaveTextContent(WRONG_CURRENT)
    expect(passwordMatches(1, GOOD)).toBe(true)
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

  it('real server, a student: POST /auth/password-reset with the current and the new password', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const sent: { body: unknown; auth: unknown }[] = []
    await stubHttp(
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('/auth/password-reset')) {
          sent.push({ body: JSON.parse(init.body as string), auth: (init.headers as Record<string, string>).Authorization })
          return new Response(null, { status: 204 })
        }
        return new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
      }),
    )
    signIn(SAM)
    const { fill } = await open('/settings')
    await fill(GOOD, GOOD, 'Old-Password-1')
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
    expect(sent).toEqual([{ body: { old_password: 'Old-Password-1', new_password: GOOD }, auth: 'Bearer acc' }])
  })

  it('real server: a wrong current password is said in words, and a server without the route says so', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const calls: string[] = []
    let answer = new Response(JSON.stringify({ error: 'invalid_credentials', message: 'current password is incorrect' }), { status: 401 })
    await stubHttp(
      vi.fn(async (url: string) => {
        calls.push(url.replace('https://api.test', ''))
        return answer.clone()
      }),
    )
    signIn(SAM)
    const { fill } = await open('/settings')
    await fill(GOOD, GOOD)
    const card = screen.getByRole('region', { name: 'Change password' })
    expect(await within(card).findByRole('alert')).toHaveTextContent(WRONG_CURRENT)
    // a wrong password is not an expired session: no refresh, and the person stays signed in
    expect(calls.filter((c) => c === '/auth/password-reset')).toHaveLength(1)
    expect(calls).not.toContain('/auth/refresh')
    expect(localStorage.getItem('auth_user')).not.toBeNull()

    answer = new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText(NOT_SUPPORTED)).toBeInTheDocument()
  })

  it('real server, an admin: the same route, and the admin stays signed in', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const sent: { path: string; method?: string; body?: unknown }[] = []
    await stubHttp(
      vi.fn(async (url: string, init: RequestInit) => {
        const path = url.replace('https://api.test', '')
        sent.push({ path, method: init.method, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) })
        if (path === '/auth/password-reset') return new Response(null, { status: 204 })
        return new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
      }),
    )
    signIn(ADMIN)
    const { fill } = await open('/admin/settings')
    await fill(GOOD, GOOD)
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
    expect(sent.find((c) => c.path === '/auth/password-reset')).toMatchObject({
      method: 'POST',
      body: { old_password: 'Old-Password-1', new_password: GOOD },
    })
    expect(screen.queryByRole('heading', { name: 'Sign in to the admin panel' })).not.toBeInTheDocument()
  })
})
