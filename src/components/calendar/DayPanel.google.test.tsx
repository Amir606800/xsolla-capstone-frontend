import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { CalendarEvent } from '../../types/calendar'
import type { EventEditing } from './DayPanel'
import { DayPanel } from './DayPanel'

const at = (h: number) => new Date(2026, 10, 9, h)
const NOW = at(7)
const signIn = (roles: string[]) => localStorage.setItem('auth_user', JSON.stringify({ id: 5, name: 'Pat', email: 'p@x.co', roles }))

const lecture: CalendarEvent = {
  id: '1',
  title: 'Weekly lecture',
  kind: 'lecture',
  startsAt: at(10).toISOString(),
  endsAt: at(12).toISOString(),
  moduleId: '5',
  attendees: [
    { id: 1, name: 'Admin', email: 'admin@edu.com' },
    { id: 5, name: 'User user', email: 'user1@example.com' },
  ],
}
const mine: CalendarEvent = {
  id: 'google-g1',
  title: 'Dentist appointment',
  kind: 'google',
  source: 'google',
  googleEventId: 'g1',
  startsAt: at(14).toISOString(),
  endsAt: at(15).toISOString(),
  location: 'Smile Clinic',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  htmlLink: 'https://www.google.com/calendar/event?eid=1',
}
const editing: EventEditing = { canEdit: (e) => e.source !== 'google', onEdit: () => undefined, onDelete: async () => undefined }

describe('attendees on an event card', () => {
  it('shows the count and the names, never the emails', async () => {
    signIn(['student'])
    const { container } = renderWithProviders(<DayPanel date={at(0)} events={[lecture]} now={NOW} />)
    const summary = await screen.findByText('Attendees (2)')
    expect(summary.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('User user')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('@')
  })

  it('an event with nobody on it shows no section', async () => {
    signIn(['student'])
    renderWithProviders(<DayPanel date={at(0)} events={[{ ...lecture, attendees: [] }, { ...lecture, id: '2', attendees: undefined }]} now={NOW} />)
    await screen.findAllByText('Weekly lecture')
    expect(screen.queryByText(/^Attendees/)).toBeNull()
  })
})

describe('the person’s own Google events in the day panel', () => {
  it('shows what Google knows, a link out and the Meet link, read-only, with the Google kind and no school badge', async () => {
    signIn(['lecturer'])
    renderWithProviders(<DayPanel date={at(0)} events={[mine]} now={NOW} editing={editing} />)
    const card = within((await screen.findByText('Dentist appointment')).closest('li')!)
    expect(card.getByText('Google')).toBeInTheDocument()
    expect(card.getByText('Smile Clinic')).toBeInTheDocument()
    expect(card.getByRole('link', { name: /Open in Google Calendar/ })).toHaveAttribute('href', mine.htmlLink)
    expect(card.getByRole('link', { name: /Meet/ })).toHaveAttribute('href', mine.meetingUrl)
    expect(card.queryByText('On Google Calendar')).toBeNull()
    expect(card.queryByRole('button', { name: /Edit|Delete/ })).toBeNull()
  })

  it('a student also gets the link to their own Google event before it starts', async () => {
    signIn(['student'])
    renderWithProviders(<DayPanel date={at(0)} events={[mine]} now={NOW} />)
    expect(await screen.findByRole('link', { name: /Meet/ })).toHaveAttribute('href', mine.meetingUrl)
  })
})
