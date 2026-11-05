import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchEvents } from '../api/events'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'

// Fix "today" (Wed 4 Nov 2026) so the relative mock data lands on known days.
// Only Date is faked; timers stay real so async UI keeps working.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

function renderCalendar() {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )
  return renderWithProviders(<App />, { route: '/calendar' })
}

const grid = () => screen.getByRole('group', { name: 'Month view' })
const day = (label: string | RegExp) => within(grid()).getByRole('button', { name: label })

async function ready() {
  return await screen.findByRole('group', { name: 'Month view' })
}

describe('CalendarPage - month view', () => {
  it('shows the page title and the current month on top', async () => {
    renderCalendar()
    expect(await screen.findByRole('heading', { name: 'Calendar', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'November 2026', level: 2 })).toHaveAttribute('aria-live', 'polite')
  })

  it('shows a loading state, then the grid', async () => {
    renderCalendar()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading calendar')
    await ready()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders 42 date boxes starting on Monday, with leading/trailing days of other months', async () => {
    renderCalendar()
    await ready()
    const cells = within(grid()).getAllByRole('button')
    expect(cells).toHaveLength(42)
    expect(cells[0]).toHaveAccessibleName(/^Monday, October 26/)
    expect(cells[41]).toHaveAccessibleName(/^Sunday, December 6/)
    expect(cells[0]).toHaveClass('is-outside')
    expect(day(/^Thursday, November 12/)).not.toHaveClass('is-outside')
  })

  it('marks today and selects it by default, without opening any pop-up', async () => {
    renderCalendar()
    await ready()
    const today = day(/^Wednesday, November 4/)
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(today).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('indicates events inside the date box, with their time', async () => {
    renderCalendar()
    await ready()
    const lecture = day('Monday, November 2, 1 event')
    expect(lecture).toHaveTextContent('10:00')
    expect(lecture).toHaveTextContent('Lecture')

    const mentor = day('Thursday, November 5, 1 event')
    expect(mentor).toHaveTextContent('15:30') // the first time that is still free
    expect(mentor).toHaveTextContent('5 free 1:1 times')
  })

  it('keeps the calendar uncluttered: at most 2 events on any day of the month', async () => {
    renderCalendar()
    await ready()
    const counts = within(grid())
      .getAllByRole('button')
      .map((c) => Number(/(\d+) events?$/.exec(c.getAttribute('aria-label') ?? '')?.[1] ?? 0))
    expect(Math.max(...counts)).toBeLessThanOrEqual(2)
    expect(counts.filter((n) => n > 0).length).toBeGreaterThan(5) // still has things to show
    expect(counts.reduce((a, b) => a + b, 0)).toBeLessThan(30)
  })

  it('does not show tasks of modules that are not open yet', async () => {
    renderCalendar()
    await ready()
    // module 7 (opens Nov 11) has deadlines on Nov 13 and 15 - hidden from a student
    expect(day('Friday, November 13, 1 event')).not.toHaveTextContent('Due:')
    expect(day('Sunday, November 15')).not.toHaveTextContent('Due:')
    expect(within(grid()).queryByText(/Schema design/)).not.toBeInTheDocument()
  })

  it('shows those deadlines to a teacher', async () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Lec', email: 'l@x.co', role: 'teacher' }))
    renderWithProviders(<App />, { route: '/calendar' })
    await ready()
    expect(day(/^Sunday, November 15/)).toHaveTextContent('Due: Query practice')
  })

  it('includes task deadlines automatically and styles submitted ones as done', async () => {
    renderCalendar()
    await ready()
    const friday = day(/^Friday, November 6/) // module 6 "CLI tool" is submitted
    expect(friday).toHaveTextContent('Due: CLI tool')
    expect(within(friday).getByText('Due: CLI tool').closest('.ev')).toHaveClass('is-done')
  })

  it('shows empty days without any event markers', async () => {
    renderCalendar()
    await ready()
    const empty = day('Saturday, November 7')
    expect(empty.querySelector('.ev')).toBeNull()
  })

  it('lists a legend for the event types', async () => {
    renderCalendar()
    await ready()
    const legend = screen.getByRole('list', { name: 'Legend' })
    for (const t of ['Lecture', 'Meeting', 'Off-campus', 'Deadline', '1:1 times']) {
      expect(within(legend).getByText(t)).toBeInTheDocument()
    }
  })
})

describe('CalendarPage - navigation', () => {
  it('moves between months and back with Today', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'December 2026', level: 2 })).toBeInTheDocument()
    expect(within(grid()).getAllByRole('button')).toHaveLength(42)

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('heading', { name: 'October 2026', level: 2 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: 'November 2026', level: 2 })).toBeInTheDocument()
    expect(day(/^Wednesday, November 4/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('selects the 1st when landing on another month, and today when landing back on this one', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(day(/^Tuesday, December 1(,|$)/)).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(day(/^Wednesday, November 4/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('crosses year boundaries', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'January 2027', level: 2 })).toBeInTheDocument()
  })

  it('moves the selection and aria-pressed with each click', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day('Saturday, November 7'))
    expect(day('Saturday, November 7')).toHaveAttribute('aria-pressed', 'true')
    expect(day(/^Wednesday, November 4/)).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('CalendarPage - day pop-up', () => {
  const dialog = () => screen.getByRole('dialog')

  it('opens a modal with the date as its title when a date is clicked', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(day(/^Friday, November 6/))
    expect(screen.getByRole('dialog', { name: 'Friday, November 6' })).toBeInTheDocument()
    expect(dialog()).toHaveAttribute('aria-modal', 'true')
  })

  it('shows each event in detail: time, duration, place, kind, description', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day(/^Monday, November 2,/)) // the lecture

    const card = within(within(dialog()).getByRole('list', { name: 'Events' })).getByRole('listitem')
    expect(card).toHaveTextContent('Lecture')
    expect(card).toHaveTextContent('10:00 - 12:00 (2 h)')
    expect(card).toHaveTextContent('Main hall')
    expect(card).toHaveTextContent('Weekly lecture')
  })

  it('lists several events in time order, with deadline status and a link to the module', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day(/^Friday, November 6/)) // team sync + CLI tool deadline

    const items = within(within(dialog()).getByRole('list', { name: 'Events' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Team sync')
    expect(items[0]).toHaveTextContent('14:00 - 14:45 (45 min)')
    expect(items[0]).toHaveTextContent('Online')
    expect(within(items[0]).queryByRole('link')).not.toBeInTheDocument()

    expect(items[1]).toHaveTextContent('Due: CLI tool')
    expect(items[1]).toHaveTextContent('Deadline')
    expect(items[1]).toHaveTextContent('18:00')
    expect(items[1]).toHaveTextContent('Submitted')
    expect(within(items[1]).getByRole('link', { name: 'Open module' })).toHaveAttribute('href', '/courses/m6')
  })

  it('describes all-day events as such', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day(/^Friday, November 13/))
    const item = within(dialog()).getByRole('listitem')
    expect(item).toHaveTextContent('Off-campus day')
    expect(item).toHaveTextContent('All day')
    expect(item).not.toHaveTextContent('min)') // no duration for all-day
    expect(item).toHaveTextContent('No classes')
  })

  it('shows an upcoming deadline as due in N days and an overdue one in red', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day(/^Sunday, November 8/)) // HTTP server, not submitted
    expect(within(dialog()).getByText(/^Due in 4 days/)).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(day(/^Sunday, October 25/)) // module 4, never submitted
    expect(within(dialog()).getByText('Overdue')).toHaveClass('event-card__danger')
  })

  it('opens for an empty day too and says there is nothing', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day('Saturday, November 7'))
    expect(screen.getByRole('dialog', { name: 'Saturday, November 7' })).toBeInTheDocument()
    expect(within(dialog()).getByText('No events on this day.')).toBeInTheDocument()
  })

  it('closes with the close button, Escape and a click on the backdrop', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()

    await user.click(day(/^Friday, November 6/))
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(day(/^Friday, November 6/))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(day(/^Friday, November 6/))
    await user.click(dialog().parentElement!) // the backdrop
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(day(/^Friday, November 6/))
    await user.click(within(dialog()).getByRole('heading', { name: 'Friday, November 6' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument() // clicking inside keeps it open
  })

  it('keeps the clicked date selected and returns focus to it after closing', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day('Saturday, November 7'))
    await user.keyboard('{Escape}')
    expect(day('Saturday, November 7')).toHaveAttribute('aria-pressed', 'true')
    expect(day('Saturday, November 7')).toHaveFocus()
  })

  it('"Open module" in the pop-up goes to the module page', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    await user.click(day(/^Friday, November 6/))
    await user.click(within(dialog()).getByRole('link', { name: 'Open module' }))
    expect(await screen.findByRole('heading', { name: 'Go Basics', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe('hidden') // scroll lock released on navigation
  })
})

describe('CalendarPage - errors', () => {
  it('shows an error with retry and recovers', async () => {
    vi.mocked(fetchEvents).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderCalendar()

    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load the calendar")
    expect(screen.queryByRole('group', { name: 'Month view' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await ready()
    expect(screen.getByRole('heading', { name: 'November 2026', level: 2 })).toBeInTheDocument()
  })
})
