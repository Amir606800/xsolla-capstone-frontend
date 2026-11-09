import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { CalendarEvent } from '../../types/calendar'
import type { CourseModule } from '../../types/course'
import { EventForm } from '../authoring/EventForm'
import { DayModal } from './DayModal'

const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m)
const MEET = 'https://meet.google.com/abc-defg-hij'
const lecture: CalendarEvent = { id: 'l', title: 'Lecture', kind: 'lecture', startsAt: at(10).toISOString(), endsAt: at(12).toISOString(), meetingUrl: MEET }

const signIn = (roles: string[]) => localStorage.setItem('auth_user', JSON.stringify({ id: 5, name: 'Pat', email: 'p@x.co', roles }))
const open = (now: Date) => renderWithProviders(<DayModal date={at(0)} events={[lecture]} now={now} onClose={() => {}} />)

describe('the meeting link in the day pop-up', () => {
  it('a student sees the Join button while the lecture is near, and no link before that', async () => {
    signIn(['student'])
    open(at(9, 40))
    expect(await screen.findByRole('link', { name: /Join Google Meet/ })).toHaveAttribute('href', MEET)
  })

  it('a student sees only when it appears if it is too early, and never the address', async () => {
    signIn(['student'])
    const { container } = open(at(7))
    expect(await screen.findByText(/appears 30 minutes before the start, at 09:30/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Google Meet/ })).toBeNull()
    expect(container.ownerDocument.body.innerHTML).not.toContain('meet.google.com')
  })

  it('a lecturer sees the link at any time', async () => {
    signIn(['lecturer'])
    open(at(7))
    expect(await screen.findByRole('link', { name: /Open Google Meet link/ })).toHaveAttribute('href', MEET)
    expect(screen.getByText('Students see it from 09:30.')).toBeInTheDocument()
  })
})

describe('the meeting link in the event form', () => {
  const modules: CourseModule[] = []
  const form = (event?: CalendarEvent, onSave = vi.fn(async () => {})) =>
    renderWithProviders(<EventForm event={event} dayKey="2026-11-09" modules={modules} onSave={onSave} onCancel={() => {}} />)

  it('a lecture has an optional meeting link field with a hint about what students get', () => {
    form()
    expect(screen.getByLabelText(/^Meeting link/)).toHaveAttribute('type', 'url')
    expect(screen.getByText(/Students see a Join button from 30 minutes before the start, and get a notification when you add it/)).toBeInTheDocument()
  })

  it('saves the link with the lecture', async () => {
    const onSave = vi.fn(async () => {})
    const user = userEvent.setup()
    form(undefined, onSave)
    await user.type(screen.getByLabelText('Title'), 'Intro')
    await user.type(screen.getByLabelText(/^Meeting link/), MEET)
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ meetingUrl: MEET }))
  })

  it('refuses a link that is not https and keeps the form open', async () => {
    const onSave = vi.fn(async () => {})
    const user = userEvent.setup()
    form(undefined, onSave)
    await user.type(screen.getByLabelText('Title'), 'Intro')
    await user.type(screen.getByLabelText(/^Meeting link/), 'http://meet.google.com/abc')
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    expect(screen.getByText('The link must start with https://.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows the saved link when editing, and an off-campus day has no such field', async () => {
    const user = userEvent.setup()
    form(lecture)
    expect(screen.getByLabelText(/^Meeting link/)).toHaveValue(MEET)
    await user.selectOptions(screen.getByLabelText('Type'), 'Off-campus day')
    expect(within(screen.getByRole('form')).queryByLabelText(/^Meeting link/)).toBeNull()
  })
})
