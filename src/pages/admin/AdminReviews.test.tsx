import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAllReviews, fetchMissingReviews } from '../../api/adminReviews'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { AdminReview, MissingReview } from '../../types/mentorReview'

// the real list (the demo reviews) is the default; a test says what the server sends when it needs exact rows
vi.mock('../../api/adminReviews', async (importActual) => {
  const actual = await importActual<typeof import('../../api/adminReviews')>()
  return { ...actual, fetchAllReviews: vi.fn(actual.fetchAllReviews), fetchMissingReviews: vi.fn(actual.fetchMissingReviews) }
})
const serverSends = (rows: AdminReview[] | null) => vi.mocked(fetchAllReviews).mockResolvedValue(rows)

// Wed 4 Nov 2026: weeks 1-5 are over
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})
afterEach(() => vi.useRealTimers())

let n = 0
function review(over: Partial<AdminReview> = {}): AdminReview {
  n += 1
  return {
    id: `r${n}`,
    moduleId: 'm5',
    studentId: 100 + n,
    studentName: `Student ${n}`,
    mentorId: 900,
    mentorName: 'Rashad Aliyev',
    teamName: 'Team 3',
    hadSession: true,
    topics: ['goals'],
    ratings: { clarity: 4, engagement: 4, comfort: 4, time: 4 },
    overall: 4,
    submittedAt: new Date(2026, 10, 1, 10, n).toISOString(),
    ...over,
  }
}

const open = () => renderWithProviders(<App />, { route: '/admin/mentor-reviews' })
const listEl = () => screen.findByRole('list', { name: 'Reviews' })
// only the cards: a card has lists of its own (topics)
const items = async () => Array.from((await listEl()).children) as HTMLElement[]
const summary = async () => within(await screen.findByRole('list', { name: 'Summary' }))

describe('Admin: mentor reviews', () => {
  it('is in the sidebar under People and shows the demo reviews with no server', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin' })
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    await user.click(within(nav).getByRole('link', { name: 'Mentor reviews' }))
    expect(await screen.findByRole('heading', { name: 'Mentor reviews', level: 1 })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Mentor reviews' })).toHaveAttribute('href', '/admin/mentor-reviews')
    // each of the six demo teams' mentors has a row
    const table = await screen.findByRole('table', { name: 'Reviews by mentor' })
    expect(within(table).getAllByRole('row').length - 1).toBe(6)
    // the list starts with 20 and offers the rest
    expect((await items())).toHaveLength(20)
    expect(screen.getByRole('button', { name: /Show more/ })).toBeInTheDocument()
  })

  it('totals: reviews, average rating, sessions held, low scores', async () => {
    serverSends([
      review({ overall: 5 }),
      review({ overall: 4 }),
      review({ overall: 1, comment: 'It did not work for me' }),
      review({ overall: 4, hadSession: false, noSessionReason: 'not-scheduled', topics: [], ratings: {} }),
    ])
    open()
    const s = await summary()
    expect(s.getByText('Reviews').closest('.admin-tile')).toHaveTextContent('44 students')
    expect(s.getByText('Average rating').closest('.admin-tile')).toHaveTextContent('3.5 / 5')
    expect(s.getByText('Sessions held').closest('.admin-tile')).toHaveTextContent('75%3 of 4 reviews')
    expect(s.getByText('Low scores').closest('.admin-tile')).toHaveTextContent('1Overall 2 or less')
  })

  it('compares the mentors, and a click on a mentor shows only the reviews about them', async () => {
    serverSends([
      review({ mentorId: 900, mentorName: 'Rashad Aliyev', overall: 5 }),
      review({ mentorId: 900, mentorName: 'Rashad Aliyev', overall: 4 }),
      review({ mentorId: 901, mentorName: 'Aysel Mammadova', teamName: 'Team 4', overall: 2 }),
    ])
    const user = userEvent.setup()
    open()
    const table = within(await screen.findByRole('table', { name: 'Reviews by mentor' }))
    // lowest rated first
    const rows = table.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByRole('button', { name: 'Aysel Mammadova' })).toBeInTheDocument()
    expect(rows[0]).toHaveTextContent('Team 4')
    expect(rows[1]).toHaveTextContent('Rashad Aliyev')
    expect(rows[1]).toHaveTextContent('4.5')

    await user.click(within(rows[1]).getByRole('button', { name: 'Rashad Aliyev' }))
    expect((await items())).toHaveLength(2)
    expect(screen.getByLabelText('Mentor')).toHaveValue('900')
    // the table still compares everyone
    expect(table.getAllByRole('row')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect((await items())).toHaveLength(3)
  })

  it('filters by week, named from the course', async () => {
    serverSends([review({ moduleId: 'm5', studentName: 'Five Student' }), review({ moduleId: 'm4', studentName: 'Four Student' })])
    const user = userEvent.setup()
    open()
    const week = await screen.findByLabelText('Week')
    const options = within(week).getAllByRole('option').map((o) => o.textContent)
    expect(options[0]).toBe('All weeks')
    expect(options[1]).toMatch(/^Week 5 · /) // newest week first
    expect(options[2]).toMatch(/^Week 4 · /)
    await user.selectOptions(week, 'm4')
    const found = await items()
    expect(found).toHaveLength(1)
    expect(found[0]).toHaveTextContent('Four Student')
    expect(found[0]).toHaveTextContent(/Week 4 · /)
  })

  it('filters by kind: low scores, with a comment, no session; the buttons count', async () => {
    serverSends([
      review({ studentName: 'Happy Student', overall: 5 }),
      review({ studentName: 'Unhappy Student', overall: 2, comment: 'Not enough time' }),
      review({ studentName: 'Absent Student', overall: 3, hadSession: false, noSessionReason: 'mentor-unavailable', topics: [], ratings: {} }),
    ])
    const user = userEvent.setup()
    open()
    const kinds = within(await screen.findByRole('group', { name: 'Kind of review' }))
    expect(kinds.getByRole('button', { name: /^All 3/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^Low scores 1/ })).toBeInTheDocument()
    await user.click(kinds.getByRole('button', { name: /^Low scores/ }))
    expect((await items())).toHaveLength(1)
    expect(await listEl()).toHaveTextContent('Unhappy Student')
    expect(kinds.getByRole('button', { name: /^Low scores/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(kinds.getByRole('button', { name: /^No session/ }))
    expect(await listEl()).toHaveTextContent('Absent Student')
    expect(await listEl()).toHaveTextContent('No session: My mentor was not available.')

    await user.click(kinds.getByRole('button', { name: /^With a comment/ }))
    expect(await listEl()).toHaveTextContent('Not enough time')
  })

  it('searches students, mentors and comments; says so when nothing matches', async () => {
    serverSends([review({ studentName: 'Leyla Hasanova', comment: 'Clear explanations' }), review({ studentName: 'Murad Karimov' })])
    const user = userEvent.setup()
    open()
    await user.type(await screen.findByRole('searchbox', { name: 'Search reviews' }), 'leyla')
    expect((await items())).toHaveLength(1)
    await user.clear(screen.getByRole('searchbox', { name: 'Search reviews' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search reviews' }), 'explanations')
    expect(await listEl()).toHaveTextContent('Leyla Hasanova')
    await user.clear(screen.getByRole('searchbox', { name: 'Search reviews' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search reviews' }), 'zzz')
    expect(await screen.findByText('No reviews match.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect((await items())).toHaveLength(2)
  })

  it('one review shows who, about whom, the week, the session, the topics, the ratings and the comment', async () => {
    serverSends([
      review({
        studentName: 'Sam Student',
        mentorName: 'Rashad Aliyev',
        topics: ['goals', 'other'],
        otherTopic: 'CV review',
        ratings: { clarity: 5, engagement: 4, comfort: 5, time: 3 },
        overall: 4,
        comment: 'More code reviews please',
      }),
    ])
    open()
    const card = within((await items())[0])
    expect(card.getByText('Sam Student')).toBeInTheDocument()
    expect(card.getByText('Rashad Aliyev')).toBeInTheDocument()
    expect(card.getByText('4 / 5', { selector: '.admin-pill' })).toBeInTheDocument()
    expect(card.getByText('The 1:1 session took place.')).toBeInTheDocument()
    expect(card.getByText('Development goals and progress review')).toBeInTheDocument()
    expect(card.getByText('Other: CV review')).toBeInTheDocument()
    expect(card.getByText('Clarity').parentElement).toHaveTextContent('Clarity5 / 5')
    expect(card.getByText('Time').parentElement).toHaveTextContent('Time3 / 5')
    expect(card.getByText('More code reviews please')).toBeInTheDocument()
  })

  it('what the sessions were about, and why there were none', async () => {
    serverSends([
      review({ topics: ['homework', 'goals'] }),
      review({ topics: ['homework'] }),
      review({ hadSession: false, noSessionReason: 'not-scheduled', topics: [], ratings: {} }),
    ])
    open()
    const topics = within(await screen.findByRole('list', { name: 'Topics of the sessions' }))
    const first = topics.getAllByRole('listitem')
    expect(first[0]).toHaveTextContent('Homework defense and code logic2')
    expect(first[1]).toHaveTextContent('Development goals and progress review1')
    const reasons = within(await screen.findByRole('list', { name: 'Reasons for no session' }))
    expect(reasons.getByText('No session was scheduled')).toBeInTheDocument()
  })

  it('shows 20 reviews and the rest on "Show more"', async () => {
    serverSends(Array.from({ length: 25 }, () => review()))
    const user = userEvent.setup()
    open()
    expect((await items())).toHaveLength(20)
    await user.click(screen.getByRole('button', { name: 'Show more (5 left)' }))
    expect((await items())).toHaveLength(25)
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull()
  })

  it('no reviews yet', async () => {
    serverSends([])
    open()
    expect(await screen.findByText(/No reviews yet/)).toBeInTheDocument()
  })

  it('a server without the route says so, plainly (not an error)', async () => {
    serverSends(null)
    open()
    expect(await screen.findByText('The server cannot list the mentor reviews yet.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure can be tried again; Refresh loads the list again', async () => {
    vi.mocked(fetchAllReviews).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    open()
    expect(await screen.findByText('The reviews could not be loaded.')).toBeInTheDocument()
    serverSends([review({ studentName: 'Late Student' })])
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await listEl()).toHaveTextContent('Late Student')
    serverSends([review({ studentName: 'Newer Student' })])
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('Newer Student')).toBeInTheDocument()
  })

  describe('who has not sent the week’s review', () => {
    const owes = (name: string, mentorId = 900, mentorName = 'Rashad Aliyev'): MissingReview => ({
      studentId: n + 500,
      studentName: name,
      mentorId,
      mentorName,
      teamName: 'Team 3',
    })

    it('appears once a week is chosen, asks the server for that week, and goes away with "All weeks"', async () => {
      serverSends([review({ moduleId: 'm5' }), review({ moduleId: 'm4' })])
      vi.mocked(fetchMissingReviews).mockResolvedValue([owes('Lazy Student'), owes('Busy Student', 901, 'Aysel Mammadova')])
      const user = userEvent.setup()
      open()
      await user.selectOptions(await screen.findByLabelText('Week'), 'm5')
      expect(await screen.findByRole('heading', { name: 'Not sent yet (2)' })).toBeInTheDocument()
      expect(vi.mocked(fetchMissingReviews)).toHaveBeenLastCalledWith('m5')
      const list = within(screen.getByRole('list', { name: 'Students who have not sent the review' }))
      expect(list.getAllByRole('listitem')).toHaveLength(2)
      expect(list.getByText('Lazy Student').closest('li')).toHaveTextContent('Team 3 · mentor Rashad Aliyev')

      await user.selectOptions(screen.getByLabelText('Week'), 'all')
      expect(screen.queryByRole('heading', { name: /Not sent yet/ })).toBeNull()
    })

    it('follows the mentor filter', async () => {
      serverSends([review({ moduleId: 'm5', mentorId: 900 }), review({ moduleId: 'm5', mentorId: 901, mentorName: 'Aysel Mammadova' })])
      vi.mocked(fetchMissingReviews).mockResolvedValue([owes('Lazy Student'), owes('Busy Student', 901, 'Aysel Mammadova')])
      const user = userEvent.setup()
      open()
      await user.selectOptions(await screen.findByLabelText('Week'), 'm5')
      await screen.findByRole('heading', { name: 'Not sent yet (2)' })
      await user.selectOptions(screen.getByLabelText('Mentor'), '901')
      expect(await screen.findByRole('heading', { name: 'Not sent yet (1)' })).toBeInTheDocument()
      expect(screen.getByText('Busy Student')).toBeInTheDocument()
      expect(screen.queryByText('Lazy Student')).toBeNull()
    })

    it('says so when everybody has sent it', async () => {
      serverSends([review({ moduleId: 'm5' })])
      vi.mocked(fetchMissingReviews).mockResolvedValue([])
      const user = userEvent.setup()
      open()
      await user.selectOptions(await screen.findByLabelText('Week'), 'm5')
      expect(await screen.findByText(/Everyone has sent the review of Week 5/)).toBeInTheDocument()
    })

    it('is left out when the server cannot say; the reviews still show', async () => {
      serverSends([review({ moduleId: 'm5', studentName: 'Still Here' })])
      vi.mocked(fetchMissingReviews).mockResolvedValue(null)
      const user = userEvent.setup()
      open()
      await user.selectOptions(await screen.findByLabelText('Week'), 'm5')
      expect(await listEl()).toHaveTextContent('Still Here')
      expect(screen.queryByRole('heading', { name: /Not sent yet/ })).toBeNull()
    })

    it('shows who is missing even when the week has no reviews at all', async () => {
      serverSends([review({ moduleId: 'm4' }), review({ moduleId: 'm5', studentName: 'Someone' })])
      vi.mocked(fetchMissingReviews).mockResolvedValue([owes('Lazy Student')])
      const user = userEvent.setup()
      open()
      await user.selectOptions(await screen.findByLabelText('Week'), 'm5')
      await user.type(screen.getByRole('searchbox', { name: 'Search reviews' }), 'lazy')
      expect(await screen.findByText('No reviews match.')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Not sent yet (1)' })).toBeInTheDocument()
    })
  })
})
