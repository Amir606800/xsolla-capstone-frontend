import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { saveTokens } from '../api/session'
import { mockPreferences, mockProfile } from '../mocks/profile'
import { renderWithProviders } from '../test/renderWithProviders'
import { stubHttp } from '../test/stubHttp'

vi.setConfig({ testTimeout: 20_000 })

const SAM = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const signIn = (user: object = SAM) => localStorage.setItem('auth_user', JSON.stringify(user))
const html = document.documentElement

async function open() {
  renderWithProviders(<App />, { route: '/profile' })
  const about = within(await screen.findByRole('region', { name: 'About me' }))
  return { about, look: within(screen.getByRole('region', { name: 'Look and accessibility' })) }
}

afterEach(() => vi.unstubAllEnvs())

describe('the profile page: About me', () => {
  it('keeps the bio, the handles and who sees them, and shows them again next time', async () => {
    signIn()
    const user = userEvent.setup()
    const { about } = await open()
    await user.type(about.getByLabelText('Bio'), 'Go and cats.')
    await user.type(about.getByLabelText('Slack handle'), 'sam.s')
    await user.type(about.getByLabelText('GitLab handle'), 'sam-s')
    await user.click(about.getByRole('radio', { name: 'Only mentors, lecturers and admins' }))
    await user.click(about.getByRole('button', { name: 'Save' }))
    expect(await about.findByText('Saved.')).toBeInTheDocument()
    expect(mockProfile(1)).toMatchObject({ bio: 'Go and cats.', slackHandle: 'sam.s', gitlabHandle: 'sam-s', visibility: 'staff_only' })
  })

  it('stops a bio that is too long, and sends nothing', async () => {
    signIn()
    const user = userEvent.setup()
    const { about } = await open()
    await user.click(about.getByLabelText('Bio'))
    await user.paste('x'.repeat(301))
    expect(about.getByText('Keep it to 300 characters.')).toBeInTheDocument()
    expect(about.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('a file that is not a JPG, PNG or WebP picture is refused in words', async () => {
    signIn()
    const user = userEvent.setup({ applyAccept: false })
    const { about } = await open()
    await user.upload(about.getByLabelText('Choose a picture'), new File(['x'], 'cv.pdf', { type: 'application/pdf' }))
    expect(await about.findByRole('alert')).toHaveTextContent('Use a JPG, PNG or WebP picture up to 10 MB.')
    expect(mockProfile(1).avatarUrl).toBeNull()
  })
})

describe('the profile page: look and accessibility', () => {
  it('big text, the easy font, high contrast and the rest apply to the page at once, and stay', async () => {
    signIn()
    const user = userEvent.setup()
    const { look } = await open()
    expect(html.dataset.text).toBeUndefined()

    await user.click(look.getByRole('radio', { name: 'Large' }))
    await user.click(look.getByRole('radio', { name: 'Easy to read' }))
    await user.click(look.getByRole('checkbox', { name: /High contrast/ }))
    await user.click(look.getByRole('checkbox', { name: /Reduce motion/ }))
    expect(look.getByText('Saved.')).toBeInTheDocument()
    expect(html.dataset).toMatchObject({ text: 'large', font: 'dyslexia', contrast: 'high', motion: 'reduce' })
    expect(mockPreferences(1)).toMatchObject({ textSize: 'large', font: 'dyslexia', highContrast: true, reduceMotion: true })

    // a default leaves no trace on the page
    await user.click(look.getByRole('radio', { name: 'Normal', checked: false }))
    expect(html.dataset.text).toBeUndefined()
  })

  it('the settings are applied from this browser as soon as the page opens, before the server answers', async () => {
    signIn()
    localStorage.setItem('look', JSON.stringify({ textSize: 'xlarge', strongFocus: true }))
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(html.dataset).toMatchObject({ text: 'xlarge', focus: 'strong' })
  })

  it('the theme choice changes the page', async () => {
    signIn()
    const user = userEvent.setup()
    const { look } = await open()
    await user.click(look.getByRole('radio', { name: 'Dark' }))
    expect(html.dataset.theme).toBe('dark')
    expect(mockPreferences(1).theme).toBe('dark')
  })
})

describe('the profile page: a server that has no profile routes yet', () => {
  it('says so, keeps the look on this device, and does not pretend the profile is saved', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    await stubHttp(vi.fn(async () => new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })))
    signIn()
    const user = userEvent.setup()
    const { about, look } = await open()
    expect(await about.findByText(/The server cannot save this yet/)).toBeInTheDocument()
    expect(about.getByLabelText('Bio')).toBeDisabled()
    expect(about.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.click(look.getByRole('radio', { name: 'Extra large' }))
    expect(html.dataset.text).toBe('xlarge')
    expect(await look.findByText(/Saved on this device only/)).toBeInTheDocument()
  })

  it('a server with the routes: About me and the look come from it, as snake_case', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
    const sent: { path: string; method?: string; body?: unknown }[] = []
    await stubHttp(
      vi.fn(async (url: string, init: RequestInit) => {
        const path = url.replace('https://api.test', '')
        sent.push({ path, method: init.method, ...(typeof init.body === 'string' ? { body: JSON.parse(init.body) } : {}) })
        const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
        if (path === '/users/me/profile' && init.method === 'PATCH') {
          return json({ avatar_url: null, bio: 'Hello', slack_handle: '', gitlab_handle: '', visibility: 'everyone' })
        }
        if (path === '/users/me/profile') return json({ avatar_url: null, bio: 'Hi there', slack_handle: 'sam.s', gitlab_handle: '', visibility: 'everyone' })
        if (path === '/users/me/preferences' && init.method === 'PATCH') return json({ text_size: 'large', high_contrast: true })
        if (path === '/users/me/preferences') return json({ text_size: 'xlarge', theme: 'dark', colorblind_safe: true, font: 'comic-sans' })
        return new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
      }),
    )
    signIn()
    const user = userEvent.setup()
    const { about, look } = await open()
    expect(await about.findByDisplayValue('Hi there')).toBeInTheDocument()
    expect(about.getByLabelText('Slack handle')).toHaveValue('sam.s')
    // the server's look wins; a value the app does not know falls back to the default
    expect(await look.findByRole('radio', { name: 'Extra large', checked: true })).toBeInTheDocument()
    expect(html.dataset).toMatchObject({ text: 'xlarge', colorblind: 'on', theme: 'dark' })
    expect(html.dataset.font).toBeUndefined()

    await user.clear(about.getByLabelText('Bio'))
    await user.type(about.getByLabelText('Bio'), 'Hello')
    await user.click(about.getByRole('button', { name: 'Save' }))
    expect(await about.findByText('Saved.')).toBeInTheDocument()
    expect(sent.find((c) => c.method === 'PATCH' && c.path === '/users/me/profile')?.body).toEqual({
      bio: 'Hello',
      slack_handle: 'sam.s',
      gitlab_handle: '',
      visibility: 'everyone',
    })

    await user.click(look.getByRole('checkbox', { name: /High contrast/ }))
    expect(sent.find((c) => c.method === 'PATCH' && c.path === '/users/me/preferences')?.body).toEqual({ high_contrast: true })
  })
})

describe('the way in', () => {
  it('the name in the top bar is a link to the profile, and the profile is where the old Settings content went', async () => {
    signIn()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    await user.click(await screen.findByRole('link', { name: 'Sam Student profile' }))
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument()
    for (const name of ['About me', 'Look and accessibility', 'Change password']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(await screen.findByRole('button', { name: 'Connect Google Calendar' })).toBeEnabled()
    // the menu keeps the theme switch and the way out
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument()
  })
})
