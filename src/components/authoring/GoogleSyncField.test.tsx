import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { CalendarEvent } from '../../types/calendar'
import { EventForm } from './EventForm'

const signIn = (roles = ['lecturer']) => localStorage.setItem('auth_user', JSON.stringify({ id: 5, name: 'Rashad', email: 'r@xsolla.school', roles }))
const mock = (value: object) => localStorage.setItem('google_mock', JSON.stringify(value))
const CONNECTED = { connection: 'connected', account: { email: 'sam@gmail.com', name: 'Sam' } }
const existing: CalendarEvent = { id: '9', title: 'Lecture', kind: 'lecture', startsAt: new Date(2026, 10, 9, 10).toISOString(), endsAt: new Date(2026, 10, 9, 12).toISOString() }

function form(event?: CalendarEvent, onSave = vi.fn(async () => {})) {
  renderWithProviders(<EventForm event={event} dayKey="2026-11-09" modules={[]} onSave={onSave} onCancel={() => {}} />)
  return onSave
}
const box = () => screen.getByRole('checkbox', { name: 'Also add to my Google Calendar' })

describe('"Also add to my Google Calendar" on the event form', () => {
  it('is off, and enabled, once Google is connected; and says whose calendar it goes on', async () => {
    signIn()
    mock(CONNECTED)
    form()
    await screen.findByText(/It goes on sam@gmail.com calendar only/)
    expect(box()).toBeEnabled()
    expect(box()).not.toBeChecked()
  })

  it('sends the tick with the new event', async () => {
    signIn()
    mock(CONNECTED)
    const user = userEvent.setup()
    const onSave = form()
    await screen.findByText(/It goes on sam@gmail.com/)
    await user.type(screen.getByLabelText('Title'), 'Guest talk')
    await user.click(box())
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Guest talk', syncToGoogle: true }))
  })

  it('does not send it unticked', async () => {
    signIn()
    mock(CONNECTED)
    const user = userEvent.setup()
    const onSave = form()
    await screen.findByText(/It goes on sam@gmail.com/)
    await user.type(screen.getByLabelText('Title'), 'Guest talk')
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ syncToGoogle: false }))
  })

  it('is disabled, with a link to Settings, when Google is not connected', async () => {
    signIn()
    form()
    expect(await screen.findByText(/Google is not connected/)).toBeInTheDocument()
    expect(box()).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings')
  })

  it('asks for a reconnect when the connection lapsed', async () => {
    signIn()
    mock({ connection: 'reconnect' })
    form()
    expect(await screen.findByText(/needs renewing/)).toBeInTheDocument()
    expect(box()).toBeDisabled()
  })

  it('an admin is sent to the admin settings', async () => {
    signIn(['admin'])
    form()
    expect(await screen.findByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/admin/settings')
  })

  it('an event being edited cannot be added to Google later, so there is no tick', async () => {
    signIn()
    mock(CONNECTED)
    form(existing)
    expect(screen.queryByRole('checkbox', { name: 'Also add to my Google Calendar' })).toBeNull()
  })

  it('an edited event that is on Google says saving changes the Google copy too', async () => {
    signIn()
    mock(CONNECTED)
    form({ ...existing, googleEventId: 'g1' })
    expect(screen.getByText(/This event is on your Google Calendar. Saving it changes the Google copy too/)).toBeInTheDocument()
  })
})
