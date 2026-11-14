import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { listEvents } from '../mocks/contentEdits'
import { renderWithProviders } from '../test/renderWithProviders'

const LECTURER = { id: 900, name: 'Rashad Aliyev', email: 'rashad@xsolla.school', roles: ['mentor', 'lecturer'] }
const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const ADMIN = { id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }
const CONNECTED = { connection: 'connected', account: { email: 'rashad@gmail.com', name: 'Rashad Aliyev' } }

const signIn = (user: object) => localStorage.setItem('auth_user', JSON.stringify(user))
const connect = (state: object = CONNECTED) => localStorage.setItem('google_mock', JSON.stringify(state))
const dialog = () => screen.getByRole('region', { name: 'Day details' })

// whole pages with several steps: slow when the full suite runs in parallel
vi.setConfig({ testTimeout: 20_000 })

/** The lecturer opens Tuesday 10 November and adds "Guest talk", ticking the Google box or not. */
async function addTalk({ tick }: { tick: boolean }) {
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/calendar' })
  const grid = await screen.findByRole('group', { name: 'Month view' })
  await user.click(within(grid).getByRole('button', { name: /^Tuesday, November 10/ }))
  await user.click(within(dialog()).getByRole('button', { name: 'Add a lecture' }))
  const form = within(dialog()).getByRole('form', { name: 'New lecture' })
  await user.type(within(form).getByLabelText('Title'), 'Guest talk')
  fireEvent.change(within(form).getByLabelText('Starts'), { target: { value: '14:00' } })
  fireEvent.change(within(form).getByLabelText('Ends'), { target: { value: '16:00' } })
  const box = await within(form).findByRole('checkbox', { name: 'Also add to my Google Calendar' })
  if (tick) {
    await screen.findByText(/It goes on rashad@gmail.com calendar only/)
    await user.click(box)
  }
  await user.click(within(form).getByRole('button', { name: 'Add lecture' }))
  return user
}

describe('the lecturer’s calendar and Google', () => {
  it('a ticked event is put on Google: the event carries its id and the lecturer is told', async () => {
    signIn(LECTURER)
    connect()
    await addTalk({ tick: true })
    expect(await within(dialog()).findByText('Event added. Students can see it now. It is on your Google Calendar too.')).toBeInTheDocument()
    expect(listEvents().find((e) => e.title === 'Guest talk')?.googleEventId).toMatch(/^mock-/)
    // the day may also hold the weekly lecture: pick the new event's card
    const card = within(within(dialog()).getByRole('list', { name: 'Events' })).getByText('Guest talk').closest('li')!
    expect(within(card).getByText('On Google Calendar')).toBeInTheDocument()
  })

  it('an unticked event stays off Google', async () => {
    signIn(LECTURER)
    connect()
    await addTalk({ tick: false })
    expect(await within(dialog()).findByText('Event added. Students can see it now.')).toBeInTheDocument()
    expect(listEvents().find((e) => e.title === 'Guest talk')?.googleEventId).toBeUndefined()
    expect(within(dialog()).queryByText('On Google Calendar')).toBeNull()
  })

  it('when Google refuses a ticked event, the event is saved and the lecturer is warned', async () => {
    signIn(LECTURER)
    connect()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/calendar' })
    const grid = await screen.findByRole('group', { name: 'Month view' })
    await user.click(within(grid).getByRole('button', { name: /^Tuesday, November 10/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Add a lecture' }))
    const form = within(dialog()).getByRole('form', { name: 'New lecture' })
    await user.type(within(form).getByLabelText('Title'), 'Guest talk')
    await screen.findByText(/It goes on rashad@gmail.com calendar only/)
    await user.click(within(form).getByRole('checkbox', { name: 'Also add to my Google Calendar' }))
    // the connection is revoked at Google while the form is open
    connect({ connection: 'reconnect' })
    await user.click(within(form).getByRole('button', { name: 'Add lecture' }))
    const warning = await within(dialog()).findByRole('alert')
    expect(warning).toHaveTextContent('Event added. Students can see it now. But it did not reach your Google Calendar')
    expect(listEvents().find((e) => e.title === 'Guest talk')).toBeDefined()
    expect(listEvents().find((e) => e.title === 'Guest talk')?.googleEventId).toBeUndefined()
  })
})

describe('the admin’s calendar and Google', () => {
  it('with a lapsed connection the tick is off and points at the admin profile', async () => {
    signIn(ADMIN)
    connect({ connection: 'reconnect' })
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/calendar' })
    await screen.findByRole('button', { name: /^Add an event/ })
    await user.click(screen.getByRole('button', { name: /^Add an event/ }))
    const form = within(await screen.findByRole('dialog'))
    expect(await form.findByRole('link', { name: 'Open Profile' })).toHaveAttribute('href', '/admin/profile')
    expect(form.getByRole('checkbox', { name: 'Also add to my Google Calendar' })).toBeDisabled()
  })

  it('a synced event gets the mark in the list, and the "On Google Calendar" chip narrows the list to it', async () => {
    signIn(ADMIN)
    connect()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/calendar' })
    await screen.findByRole('button', { name: /^Add an event/ })
    expect(screen.queryByRole('button', { name: /^On Google Calendar/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Add an event/ }))
    const form = within(await screen.findByRole('dialog'))
    await user.type(form.getByLabelText('Title'), 'Guest talk')
    await screen.findByText(/It goes on rashad@gmail.com calendar only/)
    await user.click(form.getByRole('checkbox', { name: 'Also add to my Google Calendar' }))
    await user.click(form.getByRole('button', { name: 'Add event' }))
    expect(await screen.findByText('Event added. It is on your Google Calendar too.')).toBeInTheDocument()

    const chip = await screen.findByRole('button', { name: /^On Google Calendar/ })
    expect(chip).toHaveTextContent('1')
    const events = screen.getByRole('list', { name: 'Events' })
    expect(within(events).getAllByText('On Google Calendar')).toHaveLength(1)
    const before = within(events).getAllByRole('listitem').length
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('list', { name: 'Events' })).getAllByText('Guest talk').length).toBeGreaterThan(0)
    expect(within(screen.getByRole('list', { name: 'Events' })).getAllByRole('listitem').length).toBeLessThan(before)
  })
})

describe('the Profile pages', () => {
  it('a lecturer reaches the profile by clicking their name, and sees the Google card', async () => {
    signIn(LECTURER)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    await user.click(await screen.findByRole('link', { name: 'Rashad Aliyev profile' }))
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Connect Google Calendar' })).toBeEnabled()
  })

  it('a student has a profile too: Google in their own words, and the password form', async () => {
    signIn(STUDENT)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    await user.click(await screen.findByRole('link', { name: 'Sam Student profile' }))
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Connect Google Calendar' })).toBeEnabled()
    expect(screen.getByText('Connect your Google account to see your own Google Calendar on the school calendar.')).toBeInTheDocument()
    expect(screen.queryByText(/lectures and events you add/)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument()
  })

  it('the old /settings address leads to the profile', async () => {
    signIn(STUDENT)
    renderWithProviders(<App />, { route: '/settings' })
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument()
  })

  it('every role finds the password form on its profile, the admin in the admin section', async () => {
    for (const who of [LECTURER, STUDENT]) {
      localStorage.clear()
      signIn(who)
      const { unmount } = renderWithProviders(<App />, { route: '/profile' })
      expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument()
      unmount()
    }
    localStorage.clear()
    signIn(ADMIN)
    renderWithProviders(<App />, { route: '/admin/profile' })
    expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument()
  })

  it('the admin reaches the profile from their name, and Google’s return trip to /settings ends up there with its answer', async () => {
    signIn(ADMIN)
    connect({ connection: 'connected', account: { email: 'boss@gmail.com', name: 'Boss' } })
    renderWithProviders(<App />, { route: '/settings?google=connected' })
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('Google Calendar is connected.')).toBeInTheDocument()
    expect(await screen.findByText('boss@gmail.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'School Admin profile' })).toHaveAttribute('href', '/admin/profile')
  })
})
