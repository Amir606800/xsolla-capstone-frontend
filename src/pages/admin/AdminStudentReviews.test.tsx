import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchStudentReviews } from '../../api/studentReviews'
import App from '../../App'
import { clearFilters, filterOptions, pickFilter } from '../../test/filters'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { StudentReview } from '../../types/studentReview'

// the real list (the demo grades) is the default; a test says what the server sends when it needs exact rows
vi.mock('../../api/studentReviews', async (importActual) => {
  const actual = await importActual<typeof import('../../api/studentReviews')>()
  return { ...actual, fetchStudentReviews: vi.fn(actual.fetchStudentReviews) }
})
const serverSends = (rows: StudentReview[] | null) => vi.mocked(fetchStudentReviews).mockResolvedValue(rows)

// Wed 4 Nov 2026: weeks 1-5 are over
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})
afterEach(() => vi.useRealTimers())

let n = 0
function review(over: Partial<StudentReview> = {}): StudentReview {
  n += 1
  return {
    id: `s${n}`,
    moduleId: 'm5',
    week: 5,
    studentId: 100 + n,
    studentName: `Student ${n}`,
    mentorId: 900,
    mentorName: 'Rashad Aliyev',
    teamName: 'Team 3',
    level: 'green',
    gradedAt: new Date(2026, 10, 1, 10, n).toISOString(),
    ...over,
  }
}

const open = () => renderWithProviders(<App />, { route: '/admin/student-reviews' })
const listEl = () => screen.findByRole('list', { name: 'Reviews' })
const cards = async () => Array.from((await listEl()).children) as HTMLElement[]

describe('Admin: student reviews', () => {
  it('is in the sidebar under Feedback and shows the demo grades with no server', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin' })
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    await user.click(within(nav).getByRole('link', { name: 'Student reviews' }))
    expect(await screen.findByRole('heading', { name: 'Student reviews', level: 1 })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Student reviews' })).toHaveAttribute('href', '/admin/student-reviews')
    expect(within(nav).getByRole('group', { name: 'Feedback' })).toContainElement(within(nav).getByRole('link', { name: 'Student reviews' }))
    expect((await cards()).length).toBeGreaterThan(0)
  })

  it('has no averages, totals or tables: those are on the Analytics pages', async () => {
    serverSends([review(), review({ level: 'red' })])
    open()
    await cards()
    expect(screen.queryByRole('list', { name: 'Summary' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/Average/)).toBeNull()
  })

  it('one review shows the mentor, the student, the week, the grade and the module feedback', async () => {
    serverSends([review({ studentName: 'Leyla Hasanova', level: 'yellow', note: 'Routing app was late.' })])
    open()
    const [card] = await cards()
    expect(card).toHaveTextContent('Rashad Aliyev about Leyla Hasanova')
    expect(card).toHaveTextContent('Week 5')
    expect(card).toHaveTextContent('Team 3')
    expect(within(card).getByText('Falling behind')).toBeInTheDocument()
    expect(within(card).getByText('Module feedback')).toBeInTheDocument()
    expect(within(card).getByText('Routing app was late.')).toBeInTheDocument()
  })

  it('says so when a grade came without module feedback', async () => {
    serverSends([review()])
    open()
    expect((await cards())[0]).toHaveTextContent('No module feedback.')
  })

  it('filters by grade; the buttons count', async () => {
    serverSends([review({ level: 'red', note: 'x' }), review({ level: 'green' }), review({ level: 'green' })])
    const user = userEvent.setup()
    open()
    await cards()
    const kinds = within(screen.getByRole('group', { name: 'Kind of review' }))
    expect(kinds.getByRole('button', { name: /^No progress/ })).toHaveTextContent('1')
    expect(kinds.getByRole('button', { name: /^On track/ })).toHaveTextContent('2')
    await user.click(kinds.getByRole('button', { name: /^On track/ }))
    expect(await cards()).toHaveLength(2)
    await user.click(kinds.getByRole('button', { name: /^With feedback/ }))
    expect(await cards()).toHaveLength(1)
  })

  it('filters by week (named from the course) and by mentor', async () => {
    serverSends([
      review({ moduleId: 'm5', week: 5, studentName: 'Five Student' }),
      review({ moduleId: 'm4', week: 4, studentName: 'Four Student', mentorId: 901, mentorName: 'Aysel Mammadova' }),
    ])
    const user = userEvent.setup()
    open()
    await cards()
    const weeks = await filterOptions(user, 'Week')
    expect(weeks[0]).toBe('All weeks')
    expect(weeks[1]).toMatch(/^Week 5 · /)
    expect(weeks[2]).toMatch(/^Week 4 · /)

    await pickFilter(user, 'Week', /^Week 4/)
    expect(await cards()).toHaveLength(1)
    expect((await cards())[0]).toHaveTextContent('Four Student')

    await clearFilters(user)
    await pickFilter(user, 'Mentor', 'Rashad Aliyev')
    expect((await cards())[0]).toHaveTextContent('Five Student')
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Mentor: Rashad Aliyev')
  })

  it('searches students, mentors and feedback; says so when nothing matches', async () => {
    serverSends([review({ studentName: 'Leyla Hasanova' }), review({ studentName: 'Sam Student', note: 'Great start' })])
    const user = userEvent.setup()
    open()
    await cards()
    await user.type(screen.getByRole('searchbox', { name: 'Search student reviews' }), 'great')
    expect(await cards()).toHaveLength(1)
    await user.clear(screen.getByRole('searchbox', { name: 'Search student reviews' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search student reviews' }), 'nobody')
    expect(await screen.findByText('No reviews match.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await cards()).toHaveLength(2)
  })

  it('shows 20 reviews and the rest on "Show more"', async () => {
    serverSends(Array.from({ length: 25 }, () => review()))
    const user = userEvent.setup()
    open()
    expect(await cards()).toHaveLength(20)
    await user.click(screen.getByRole('button', { name: 'Show more (5 left)' }))
    expect(await cards()).toHaveLength(25)
  })

  it('no grades yet', async () => {
    serverSends([])
    open()
    expect(await screen.findByText(/No student reviews yet/)).toBeInTheDocument()
  })

  it('a server that lets this account read none of the weeks says so, plainly (not an error)', async () => {
    serverSends(null)
    open()
    expect(await screen.findByText(/does not let this account read the weekly grades/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure can be tried again', async () => {
    vi.mocked(fetchStudentReviews).mockRejectedValueOnce(new Error('down'))
    const user = userEvent.setup()
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    serverSends([review()])
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await cards()).toHaveLength(1)
  })
})
