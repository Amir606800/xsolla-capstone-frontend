import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders'
import { GoogleCard } from './GoogleCard'

const signIn = () => localStorage.setItem('auth_user', JSON.stringify({ id: 5, name: 'Rashad Aliyev', email: 'rashad@xsolla.school', roles: ['lecturer'] }))
const mock = (value: object) => localStorage.setItem('google_mock', JSON.stringify(value))
const show = (route = '/settings') => {
  signIn()
  return renderWithProviders(<GoogleCard />, { route })
}

describe('the Google Calendar card', () => {
  it('asks to connect when the account was never connected, and says what it does and does not do', async () => {
    show()
    expect(await screen.findByRole('button', { name: 'Connect Google Calendar' })).toBeEnabled()
    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByText(/Nothing is sent without your tick/)).toBeInTheDocument()
  })

  it('shows a loading line while it asks the server', () => {
    show()
    expect(screen.getByRole('status')).toHaveTextContent('Checking your Google connection…')
  })

  it('connecting shows the account, a Disconnect button, and the way to also remove access at Google', async () => {
    const user = userEvent.setup()
    show()
    await user.click(await screen.findByRole('button', { name: 'Connect Google Calendar' }))
    expect(await screen.findByText('rashad@gmail.com')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeEnabled()
    expect(screen.getByRole('link', { name: /Also remove access in your Google account/ })).toHaveAttribute('href', 'https://myaccount.google.com/permissions')
  })

  it('Disconnect asks once, then the account is not connected any more; Keep changes nothing', async () => {
    mock({ connection: 'connected', account: { email: 'sam@gmail.com', name: 'Sam T' } })
    const user = userEvent.setup()
    show()
    await user.click(await screen.findByRole('button', { name: 'Disconnect' }))
    const ask = screen.getByRole('group', { name: 'Disconnect Google Calendar?' })
    await user.click(within(ask).getByRole('button', { name: 'Keep' }))
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    await user.click(within(screen.getByRole('group', { name: 'Disconnect Google Calendar?' })).getByRole('button', { name: 'Yes, disconnect' }))
    expect(await screen.findByText('Not connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Google Calendar' })).toBeEnabled()
    expect(JSON.parse(localStorage.getItem('google_mock')!).connection).toBe('disconnected')
  })

  it('shows the connected account straight away when it already is', async () => {
    mock({ connection: 'connected', account: { email: 'sam@gmail.com', name: 'Sam T' } })
    show()
    expect(await screen.findByText('Sam T')).toBeInTheDocument()
    expect(screen.getByText('sam@gmail.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use a different Google account' })).toBeEnabled()
  })

  it('says the connection needs renewing and offers Reconnect', async () => {
    mock({ connection: 'reconnect', account: { email: 'sam@gmail.com', name: 'Sam T' } })
    show()
    expect(await screen.findByText('Reconnect needed')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/sam@gmail.com is no longer connected/)
    expect(screen.getByRole('button', { name: 'Reconnect Google Calendar' })).toBeEnabled()
  })

  it('shows the answer Google sent back, and refreshes the status', async () => {
    mock({ connection: 'connected', account: { email: 'sam@gmail.com', name: 'Sam T' } })
    show('/settings?google=connected')
    expect(await screen.findByText('Google Calendar is connected.')).toBeInTheDocument()
    expect(await screen.findByText('sam@gmail.com')).toBeInTheDocument()
  })

  it('says it failed, and what to try, when Google sent back an error', async () => {
    show('/settings?google=error')
    expect(await screen.findByText(/Google could not be connected/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Connect Google Calendar' })).toBeEnabled()
  })
})
