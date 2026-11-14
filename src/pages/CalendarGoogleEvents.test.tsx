import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { putEvent } from '../mocks/contentEdits'
import { renderWithProviders } from '../test/renderWithProviders'

const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const CONNECTED = { connection: 'connected', account: { email: 'sam@gmail.com', name: 'Sam Student' } }
const signIn = (user: object) => localStorage.setItem('auth_user', JSON.stringify(user))
const connect = (state: object) => localStorage.setItem('google_mock', JSON.stringify(state))

vi.setConfig({ testTimeout: 20_000 })

/** Opens the calendar on the day after today (the demo Google calendar has "Dentist appointment" then). */
async function openTomorrow() {
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/calendar' })
  const grid = await screen.findByRole('group', { name: 'Month view' })
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (tomorrow.getMonth() !== now.getMonth()) await user.click(screen.getByRole('button', { name: 'Next month' }))
  const label = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  await user.click(within(grid).getByRole('button', { name: new RegExp(`^${label}`) }))
  return user
}

describe('the calendar and the person’s own Google events', () => {
  it('a connected student sees their Google events, read-only, and a Google entry in the legend', async () => {
    signIn(STUDENT)
    connect(CONNECTED)
    await openTomorrow()
    const panel = within(screen.getByRole('region', { name: 'Day details' }))
    expect(await panel.findByText('Dentist appointment')).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: /Edit|Delete/ })).toBeNull()
    expect(within(screen.getByRole('list', { name: 'Legend' })).getByRole('button', { name: 'Google' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/Connect Google Calendar in/)).toBeNull()
  })

  it('not connected: no Google events and a hint that points at Settings', async () => {
    signIn(STUDENT)
    await openTomorrow()
    expect(await screen.findByText(/to see your Google events here\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    expect(screen.queryByText('Dentist appointment')).toBeNull()
    // the school calendar itself works
    expect(screen.getByRole('region', { name: 'Day details' })).toBeInTheDocument()
  })

  it('a revoked connection asks to reconnect and shows no Google events', async () => {
    signIn(STUDENT)
    connect({ connection: 'reconnect' })
    await openTomorrow()
    expect(await screen.findByText(/to see your Google events again\./)).toBeInTheDocument()
    expect(screen.queryByText('Dentist appointment')).toBeNull()
  })

  it('the Google entry of the legend hides them from the month grid', async () => {
    signIn(STUDENT)
    connect(CONNECTED)
    const user = await openTomorrow()
    await screen.findAllByText('Dentist appointment')
    const grid = screen.getByRole('group', { name: 'Month view' })
    expect(within(grid).getAllByText(/Dentist appointment/).length).toBeGreaterThan(0)
    await user.click(within(screen.getByRole('list', { name: 'Legend' })).getByRole('button', { name: 'Google' }))
    expect(within(grid).queryByText(/Dentist appointment/)).toBeNull()
  })

  it('a school event that is also on Google shows once, as the school event', async () => {
    signIn(STUDENT)
    connect(CONNECTED)
    const now = new Date()
    const at = (h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h).toISOString()
    putEvent({ id: 'ev-dup', title: 'Dentist appointment', kind: 'lecture', startsAt: at(10), endsAt: at(11), googleEventId: 'demo-dentist' })
    await openTomorrow()
    const panel = within(screen.getByRole('region', { name: 'Day details' }))
    await panel.findAllByText('Dentist appointment')
    // the other demo Google events of the day (if any) have loaded by now: wait for the list to settle
    await screen.findByRole('list', { name: 'Legend' })
    expect(panel.getAllByText('Dentist appointment')).toHaveLength(1)
    expect(panel.getByText('Lecture')).toBeInTheDocument()
  })
})
