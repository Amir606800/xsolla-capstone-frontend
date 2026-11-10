import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { CalendarEvent } from '../../types/calendar'
import { DayPanel } from './DayPanel'

const at = (h: number) => new Date(2026, 10, 9, h)
const event = (extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'l',
  title: 'Lecture',
  kind: 'lecture',
  startsAt: at(10).toISOString(),
  endsAt: at(12).toISOString(),
  ...extra,
})
const signIn = (roles: string[]) => localStorage.setItem('auth_user', JSON.stringify({ id: 5, name: 'Pat', email: 'p@x.co', roles }))
const open = (e: CalendarEvent) => renderWithProviders(<DayPanel date={at(0)} events={[e]} now={at(8)} />)

describe('the "On Google Calendar" mark in the day panel', () => {
  it('shows on an event that is on Google, for staff', async () => {
    signIn(['lecturer'])
    open(event({ googleEventId: 'g1' }))
    expect(await screen.findByText('On Google Calendar')).toBeInTheDocument()
  })

  it('is not on an event that is not', async () => {
    signIn(['lecturer'])
    open(event())
    await screen.findByRole('heading', { name: 'Lecture' })
    expect(screen.queryByText('On Google Calendar')).toBeNull()
  })

  it('students never see it: the copy is on the lecturer calendar, not theirs', async () => {
    signIn(['student'])
    open(event({ googleEventId: 'g1' }))
    await screen.findByRole('heading', { name: 'Lecture' })
    expect(screen.queryByText('On Google Calendar')).toBeNull()
  })
})
