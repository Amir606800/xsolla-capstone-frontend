import { screen } from '@testing-library/react'
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
const signIn = (u: object = SAM) => localStorage.setItem('auth_user', JSON.stringify(u))
const GOOD = 'Zebra-Quartz-7781'

async function open() {
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/settings' })
  await screen.findByRole('heading', { name: 'Change password' })
  const fill = async (current: string, next: string, again: string) => {
    for (const [label, value] of [
      ['Current password', current],
      ['New password', next],
      ['New password again', again],
    ] as const) {
      const input = screen.getByLabelText(label)
      await user.clear(input)
      await user.type(input, value)
    }
    await user.click(screen.getByRole('button', { name: 'Change password' }))
  }
  return { user, fill }
}

describe('change my own password', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('checks every field before anything is sent', async () => {
    signIn()
    const { user } = await open()
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('Enter your current password.')).toBeInTheDocument()
    expect(screen.getByText('Enter a new password.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Current password'), 'old-one')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('New password again'), 'other')
    expect(screen.getByText('Use 10 to 72 characters.')).toBeInTheDocument()
    expect(screen.getByText('The two new passwords are not the same.')).toBeInTheDocument()
  })

  it('refuses the same password as the current one', async () => {
    signIn()
    const { fill } = await open()
    await fill(GOOD, GOOD, GOOD)
    expect(screen.getByText('Choose a password different from the current one.')).toBeInTheDocument()
  })

  it('changes it: the old one stops working in the demo, the form empties and says so', async () => {
    signIn()
    const { fill } = await open()
    await fill('anything', GOOD, GOOD)
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(passwordMatches(1, GOOD)).toBe(true)
    expect(passwordMatches(1, 'anything')).toBe(false)
  })

  it('a wrong current password is said plainly (in the demo, once one was set)', async () => {
    signIn()
    const { fill } = await open()
    await fill('anything', GOOD, GOOD)
    await screen.findByRole('status')
    await fill('not-the-old-one', 'Quartz-Zebra-9917', 'Quartz-Zebra-9917')
    expect(await screen.findByRole('alert')).toHaveTextContent(WRONG_CURRENT)
  })

  it('works for a lecturer too', async () => {
    signIn({ id: 902, name: 'Elvin Huseynov', email: 'teacher@xsolla.school', roles: ['lecturer'] })
    const { fill } = await open()
    await fill('x', GOOD, GOOD)
    expect(await screen.findByRole('status')).toHaveTextContent('Your password is changed')
  })

  it('on the real server: sends the current and the new password; a server without the route says so', async () => {
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
    signIn()
    const { fill } = await open()
    await fill('old-pass-1', GOOD, GOOD)
    expect(await screen.findByText(NOT_SUPPORTED)).toBeInTheDocument()
    expect(sent).toEqual([{ current_password: 'old-pass-1', password: GOOD }])
  })
})
