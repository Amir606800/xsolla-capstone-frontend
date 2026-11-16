import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLectureReviews } from '../../api/adminLectureReviews'
import App from '../../App'
import { clearFilters, filterOptions, pickFilter } from '../../test/filters'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { AdminLectureReview } from '../../types/lectureReview'

// the setup fakes this module with vi.fn functions over the fixture school
const serverSends = (rows: AdminLectureReview[] | null) => vi.mocked(fetchLectureReviews).mockResolvedValue(rows)

// Wed 4 Nov 2026: the demo's lectures of 19 Oct, 26 Oct and 2 Nov are over
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})
afterEach(() => vi.useRealTimers())

let n = 0
function review(over: Partial<AdminLectureReview> & { title?: string; eventId?: string } = {}): AdminLectureReview {
  n += 1
  const { title = 'Goroutines', eventId = '41', ...rest } = over
  return {
    id: `r${n}`,
    lecture: { eventId, title, startsAt: '2026-11-02T06:00:00.000Z', endsAt: '2026-11-02T08:00:00.000Z', moduleId: '5', moduleTitle: 'React' },
    lecturers: [{ id: 902, name: 'Elvin Huseynov' }],
    studentId: 100 + n,
    studentName: `Student ${n}`,
    overall: 4,
    clarity: 4,
    practice: 4,
    confidence: 4,
    pace: 'just_right',
    submittedAt: new Date(2026, 10, 3, 10, n).toISOString(),
    ...rest,
  }
}

const open = () => renderWithProviders(<App />, { route: '/admin/lecture-reviews' })
const listEl = () => screen.findByRole('list', { name: 'Reviews' })
// only the cards: a card has lists of its own
const cards = async () => Array.from((await listEl()).children) as HTMLElement[]

describe('Admin: lecture reviews', () => {
  it('is in the sidebar under Feedback and shows the demo reviews with no server', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin' })
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    await user.click(within(nav).getByRole('link', { name: 'Lecture reviews' }))
    expect(await screen.findByRole('heading', { name: 'Lecture reviews', level: 1 })).toBeInTheDocument()
    expect(within(nav).getByRole('group', { name: 'Feedback' })).toContainElement(within(nav).getByRole('link', { name: 'Lecture reviews' }))
    expect(await cards()).toHaveLength(20)
    expect(screen.getByRole('button', { name: /Show more/ })).toBeInTheDocument()
  })

  it('has no averages, totals or tables: those are on the Analytics pages', async () => {
    serverSends([review({ overall: 5 }), review({ overall: 1, improve: 'Too much at once' })])
    open()
    await cards()
    expect(screen.queryByRole('list', { name: 'Summary' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/Average rating/)).toBeNull()
    expect(screen.queryByText(/Pace just right/)).toBeNull()
    expect(screen.queryByText('How was the pace?')).toBeNull()
  })

  it('filters by lecturer, also for a lecture taught by two, and finds the lectures with no lecturer', async () => {
    serverSends([
      review({ lecturers: [{ id: 902, name: 'Elvin Huseynov' }], title: 'Goroutines' }),
      review({ lecturers: [{ id: 902, name: 'Elvin Huseynov' }], title: 'Goroutines' }),
      review({ lecturers: [{ id: 902, name: 'Elvin Huseynov' }, { id: 900, name: 'Rashad Aliyev' }], title: 'Channels', eventId: '42' }),
      review({ lecturers: [], title: 'Intro', eventId: '50' }),
    ])
    const user = userEvent.setup()
    open()
    await cards()
    expect((await filterOptions(user, 'Lecturer')).slice(1)).toEqual(['Elvin Huseynov', 'Rashad Aliyev', 'No lecturer assigned'])

    await pickFilter(user, 'Lecturer', 'Elvin Huseynov')
    expect(await cards()).toHaveLength(3)
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Lecturer: Elvin Huseynov')

    await pickFilter(user, 'Lecturer', 'Rashad Aliyev')
    expect(await cards()).toHaveLength(1)

    await pickFilter(user, 'Lecturer', 'No lecturer assigned')
    expect((await cards())[0]).toHaveTextContent('Intro')

    await clearFilters(user)
    expect(await cards()).toHaveLength(4)
  })

  it('filters by lecture and by kind; the buttons count', async () => {
    serverSends([
      review({ title: 'Goroutines', overall: 5, eventId: '41' }),
      review({ title: 'Channels', overall: 2, eventId: '42', improve: 'Too fast' }),
      review({ title: 'Channels', overall: 4, eventId: '42', liked: 'Great examples' }),
    ])
    const user = userEvent.setup()
    open()
    const kinds = within(await screen.findByRole('group', { name: 'Kind of review' }))
    expect(kinds.getByRole('button', { name: /^All 3/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^Low scores 1/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^With a comment 2/ })).toBeInTheDocument()

    await user.click(kinds.getByRole('button', { name: /^Low scores/ }))
    expect(await cards()).toHaveLength(1)
    expect(await listEl()).toHaveTextContent('Too fast')

    await user.click(kinds.getByRole('button', { name: /^All/ }))
    await pickFilter(user, 'Lecture', /^Goroutines/)
    expect(await cards()).toHaveLength(1)
    expect(await listEl()).toHaveTextContent('Goroutines')
  })

  it('filters by week, named from the course, and finds the lectures with no week; a week’s comments are one more click', async () => {
    const at = (moduleId: string | undefined, eventId: string) => ({
      eventId,
      title: 'Goroutines',
      startsAt: '2026-11-02T06:00:00.000Z',
      endsAt: '2026-11-02T08:00:00.000Z',
      ...(moduleId ? { moduleId, moduleTitle: 'Server title' } : {}),
    })
    serverSends([
      review({ studentName: 'Five Student', lecture: at('m5', '41'), improve: 'Slower please' }),
      review({ studentName: 'Four Student', lecture: at('m4', '40'), liked: 'Great examples' }),
      review({ studentName: 'Four Quiet', lecture: at('m4', '40') }),
      review({ studentName: 'No Week', lecture: at(undefined, '50'), lecturers: [] }),
    ])
    const user = userEvent.setup()
    open()
    await listEl()
    const options = await filterOptions(user, 'Week')
    expect(options[0]).toBe('All weeks')
    expect(options[1]).toMatch(/^Week 5 · /) // newest first, named from the course
    expect(options[2]).toMatch(/^Week 4 · /)
    expect(options[3]).toBe('Lectures with no week')

    await pickFilter(user, 'Week', /^Week 4/)
    expect((await cards()).map((c) => c.textContent)).toEqual([expect.stringContaining('Four'), expect.stringContaining('Four')])
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent(/Week: Week 4/)

    // the week's comments
    await user.click(screen.getByRole('button', { name: /^With a comment/ }))
    expect(await cards()).toHaveLength(1)
    expect(await listEl()).toHaveTextContent('Great examples')

    await user.click(screen.getByRole('button', { name: /^All/ }))
    await pickFilter(user, 'Week', 'Lectures with no week')
    expect(await cards()).toHaveLength(1)
    expect(await listEl()).toHaveTextContent('No Week')
  })

  it('searches students, lectures, lecturers and comments; says so when nothing matches', async () => {
    serverSends([review({ studentName: 'Leyla Hasanova', improve: 'Share the slides first' }), review({ studentName: 'Murad Karimov' })])
    const user = userEvent.setup()
    open()
    const search = await screen.findByRole('searchbox', { name: 'Search lecture reviews' })
    await user.type(search, 'slides first')
    expect(await cards()).toHaveLength(1)
    await user.clear(search)
    await user.type(search, 'elvin')
    expect(await cards()).toHaveLength(2)
    await user.clear(search)
    await user.type(search, 'zzz')
    expect(await screen.findByText('No reviews match.')).toBeInTheDocument()
  })

  it('one review shows who, which lecture and whose, the scores, the pace and both comments', async () => {
    serverSends([
      review({ studentName: 'Anna', title: 'Goroutines', overall: 4, clarity: 5, practice: 3, confidence: 2, pace: 'too_fast', liked: 'The live coding', improve: 'A bit slower please' }),
    ])
    open()
    const card = within((await cards())[0])
    expect(card.getByText('Anna')).toBeInTheDocument()
    expect(card.getByText('Goroutines')).toBeInTheDocument()
    expect(card.getByText('4 / 5', { selector: '.admin-pill' })).toBeInTheDocument()
    expect(card.getByText(/Lecturer: Elvin Huseynov/)).toBeInTheDocument()
    expect(card.getByText(/· React/)).toBeInTheDocument()
    expect(card.getByText('Clarity').parentElement).toHaveTextContent('Clarity5 / 5')
    expect(card.getByText('Practice').parentElement).toHaveTextContent('Practice3 / 5')
    expect(card.getByText('Confidence').parentElement).toHaveTextContent('Confidence2 / 5')
    expect(card.getByText('Pace').parentElement).toHaveTextContent('PaceToo fast')
    expect(card.getByText('What worked well')).toBeInTheDocument()
    expect(card.getByText('The live coding')).toBeInTheDocument()
    expect(card.getByText('A bit slower please')).toBeInTheDocument()
  })

  it('times on a card are on the 24-hour clock', async () => {
    serverSends([review()])
    open()
    expect(await listEl()).toHaveTextContent(/Nov 2, \d\d:\d\d–\d\d:\d\d/)
    expect(await listEl()).not.toHaveTextContent(/AM|PM/)
  })

  it('shows 20 reviews and the rest on "Show more"', async () => {
    serverSends(Array.from({ length: 25 }, () => review()))
    const user = userEvent.setup()
    open()
    expect(await cards()).toHaveLength(20)
    await user.click(screen.getByRole('button', { name: 'Show more (5 left)' }))
    expect(await cards()).toHaveLength(25)
  })

  it('no reviews yet', async () => {
    serverSends([])
    open()
    expect(await screen.findByText(/No lecture reviews yet/)).toBeInTheDocument()
  })

  it('a server without the route says so, plainly (not an error)', async () => {
    serverSends(null)
    open()
    expect(await screen.findByText('The server cannot list the lecture reviews yet.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure can be tried again; Refresh loads the list again', async () => {
    vi.mocked(fetchLectureReviews).mockRejectedValueOnce(new Error('boom'))
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
})
