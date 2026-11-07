import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '../../types/calendar'
import { DayCell } from './DayCell'

const NOW = new Date(2026, 10, 4, 12)
const DAY = new Date(2026, 10, 12)
const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m).toISOString()

const event = (id: number, over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: String(id),
  title: `Event ${id}`,
  kind: 'meeting',
  startsAt: at(8 + id),
  endsAt: at(9 + id),
  ...over,
})

function renderCell(events: CalendarEvent[] = [], props: Partial<Parameters<typeof DayCell>[0]> = {}) {
  const onSelect = vi.fn()
  render(<DayCell date={DAY} inMonth isToday={false} selected={false} events={events} now={NOW} onSelect={onSelect} {...props} />)
  return onSelect
}

describe('DayCell', () => {
  it('shows the date number and an accessible label', () => {
    renderCell()
    const cell = screen.getByRole('button', { name: 'Thursday, November 12' })
    expect(cell).toHaveTextContent('12')
    expect(cell).toHaveAttribute('aria-pressed', 'false')
    expect(cell).not.toHaveAttribute('aria-current')
  })

  it('shows each event with its time inside the box, and counts them in the label', () => {
    renderCell([event(1), event(2)])
    const cell = screen.getByRole('button', { name: 'Thursday, November 12, 2 events' })
    expect(cell).toHaveTextContent('09:00')
    expect(cell).toHaveTextContent('Event 1')
    expect(cell).toHaveTextContent('10:00')
    expect(cell).toHaveTextContent('Event 2')
  })

  it('uses the singular for one event', () => {
    renderCell([event(1)])
    expect(screen.getByRole('button', { name: 'Thursday, November 12, 1 event' })).toBeInTheDocument()
  })

  it('caps the chips at 3 and summarises the rest', () => {
    renderCell([1, 2, 3, 4, 5].map((i) => event(i)))
    const cell = screen.getByRole('button', { name: /5 events$/ })
    expect(cell).toHaveTextContent('Event 3')
    expect(cell).not.toHaveTextContent('Event 4')
    expect(cell).toHaveTextContent('+2 more')
  })

  it('omits the time for all-day events', () => {
    renderCell([event(1, { allDay: true, startsAt: at(0), endsAt: at(23, 59) })])
    expect(screen.getByRole('button')).not.toHaveTextContent(/\d\d:\d\d/)
  })

  it('marks today, selection and out-of-month days', () => {
    renderCell([], { isToday: true, selected: true, inMonth: false })
    const cell = screen.getByRole('button')
    expect(cell).toHaveAttribute('aria-current', 'date')
    expect(cell).toHaveAttribute('aria-pressed', 'true')
    expect(cell).toHaveClass('is-today', 'is-selected', 'is-outside')
  })

  it('styles deadlines by state: done, overdue, upcoming', () => {
    const deadline = (id: number, startsAt: string, done: boolean) =>
      event(id, { kind: 'deadline', title: `D${id}`, startsAt, endsAt: startsAt, done })
    renderCell([
      deadline(1, new Date(2026, 10, 12, 9).toISOString(), true), // submitted
      deadline(2, new Date(2026, 10, 1, 9).toISOString(), false), // before NOW, unsubmitted
      deadline(3, new Date(2026, 10, 20, 9).toISOString(), false), // after NOW
    ])
    const chip = (t: string) => screen.getByText(t).closest('.ev')!
    expect(chip('D1')).toHaveClass('is-done')
    expect(chip('D2')).toHaveClass('is-overdue')
    expect(chip('D3')).not.toHaveClass('is-done')
    expect(chip('D3')).not.toHaveClass('is-overdue')
  })

  it('shades events that are over; upcoming ones keep their full colour (for every role)', () => {
    // seen on Nov 12 at 13:00: the 9-10 meeting is over, the 15-16 one is still to come
    render(
      <DayCell
        date={DAY}
        inMonth
        isToday={false}
        selected={false}
        now={new Date(2026, 10, 12, 13)}
        onSelect={vi.fn()}
        events={[event(1, { title: 'Done already' }), event(7, { title: 'Still to come' })]}
      />,
    )
    expect(screen.getByText('Done already').closest('.ev')).toHaveClass('is-past')
    expect(screen.getByText('Still to come').closest('.ev')).not.toHaveClass('is-past')
    const dots = document.querySelectorAll('.cell__dots .dot')
    expect([...dots].map((d) => d.classList.contains('is-past'))).toEqual([true, false])
  })

  it('a deadline is never "past": it is done or overdue instead', () => {
    const due = new Date(2026, 10, 1, 9).toISOString()
    renderCell([event(1, { kind: 'deadline', title: 'Due', startsAt: due, endsAt: due })])
    expect(screen.getByText('Due').closest('.ev')).not.toHaveClass('is-past')
  })

  it('is tinted when it is inside a picked range of days', () => {
    renderCell([], { inRange: true })
    expect(screen.getByRole('button')).toHaveClass('is-in-range')
  })

  it('reports its day when clicked, and whether Shift was held (to stretch a range)', async () => {
    const onSelect = renderCell()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenLastCalledWith('2026-11-12', false)
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button'))
    await user.keyboard('{/Shift}')
    expect(onSelect).toHaveBeenLastCalledWith('2026-11-12', true)
  })
})
