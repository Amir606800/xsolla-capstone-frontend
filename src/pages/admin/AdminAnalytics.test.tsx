import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAiSummary, fetchOverview } from '../../api/analytics'
import { ApiError } from '../../api/http'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

// the demo analytics are the default; a test can make one request fail
vi.mock('../../api/analytics', async (importActual) => {
  const actual = await importActual<typeof import('../../api/analytics')>()
  return { ...actual, fetchOverview: vi.fn(actual.fetchOverview), fetchAiSummary: vi.fn(actual.fetchAiSummary) }
})

beforeEach(() => {
  vi.mocked(fetchOverview).mockClear()
  vi.mocked(fetchAiSummary).mockClear()
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }),
  )
})

const open = (route: string) => renderWithProviders(<App />, { route })
const panel = (name: string) => screen.findByRole('region', { name })
const glance = () => panel('At a glance')

describe('Admin analytics: the school', () => {
  it('is in the sidebar under Insights; the overview shows the school at a glance, who needs attention, the weeks, the mentors and lecturers', async () => {
    const user = userEvent.setup()
    open('/admin')
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    await user.click(within(nav).getByRole('link', { name: 'Analytics' }))
    expect(await screen.findByRole('heading', { name: 'Analytics', level: 1 })).toBeInTheDocument()

    const tabs = screen.getByRole('navigation', { name: 'Analytics sections' })
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Overview', 'Students', 'Mentors', 'Lecturers'])

    // how the students stand now: the ring and its key say the same in words
    const school = await panel('The school at a glance')
    expect(
      within(school).getByRole('img', {
        name: /^Students now: \d+ on track, \d+ falling behind, \d+ no progress, \d+ not graded yet of 29$/,
      }),
    ).toBeInTheDocument()
    expect(within(school).getByRole('list', { name: 'Students now key' })).toHaveTextContent('Not graded yet')
    // a student nobody graded yet does not count as behind
    expect(school).toHaveTextContent(/\d+ of \d+ graded students on track now\. \d+ not graded yet\./)

    // Sam has two yellow weeks in a row: named, with the reason, linking to the student's page
    const attention = await screen.findByRole('list', { name: 'Students who need attention' })
    const sam = within(attention).getByRole('link', { name: 'Sam Student' })
    expect(sam).toHaveAttribute('href', '/admin/analytics/students/1')
    expect(sam.closest('li')).toHaveTextContent('Falling behind')

    const weeks = await screen.findByRole('table', { name: 'Weekly student standing' })
    expect(within(weeks).getByRole('rowheader', { name: /Week 1/ })).toBeInTheDocument()

    const mentors = await screen.findByRole('table', { name: /Every mentor/ })
    expect(within(mentors).getByRole('link', { name: 'Rashad Aliyev' })).toHaveAttribute('href', '/admin/analytics/mentors/900')
    const lecturers = screen.getByRole('table', { name: /Every lecturer/ })
    expect(within(lecturers).getByRole('link', { name: 'Elvin Huseynov' })).toHaveAttribute(
      'href',
      '/admin/analytics/lecturers/902',
    )
  })

  it('a failed weekly chart can be tried again; the rest of the overview stays', async () => {
    vi.mocked(fetchOverview).mockRejectedValueOnce(new Error('Server down'))
    const user = userEvent.setup()
    open('/admin/analytics')
    expect(await screen.findByText('Server down')).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Students who need attention' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'Weekly student standing' })).toBeInTheDocument()
    expect(screen.queryByText('Server down')).not.toBeInTheDocument()
  })
})

describe('Admin analytics: a student', () => {
  it('the student list shows how each one stands now and opens their page', async () => {
    const user = userEvent.setup()
    open('/admin/analytics/students')
    expect(await screen.findByRole('heading', { name: 'Student analytics', level: 1 })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Search students' }), 'Sam')
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Students' })).getAllByRole('listitem')).toHaveLength(1))
    const row = screen.getByRole('link', { name: /Sam Student/ })
    await waitFor(() => expect(row).toHaveTextContent('Falling behind'))
    await user.click(row)
    expect(await screen.findByRole('heading', { name: 'Sam Student', level: 1 })).toBeInTheDocument()
  })

  it('shows the verdict from the program rules first, then the AI summary, the weeks with the mentor notes, hand-ins and quizzes', async () => {
    open('/admin/analytics/students/1')
    expect(await screen.findByRole('heading', { name: 'Sam Student', level: 1 })).toBeInTheDocument()

    const top = await glance()
    await waitFor(() => expect(top).toHaveTextContent('2 yellow weeks in a row up to week 5'))
    expect(top.querySelector('.glance__verdict')).toHaveTextContent('Falling behind')
    // weeks by the level that counts: green, red, green, yellow, yellow
    expect(
      within(top).getByRole('img', { name: 'Weeks by grade: 2 on track, 2 falling behind, 1 no progress of 5' }),
    ).toBeInTheDocument()
    expect(top).toHaveTextContent('Rashad Aliyev')

    const summary = await panel('AI summary')
    await waitFor(() => expect(summary).toHaveTextContent('Demo text made by the app'))
    expect(fetchAiSummary).toHaveBeenCalledWith('students', 1, { from: undefined, to: undefined, force: false })

    // the latest four weeks first, the rest on request
    const notes = await screen.findByRole('list', { name: 'Mentor feedback by week' })
    expect(within(notes).getByText('Behind on the tasks, but you are catching up.')).toBeInTheDocument()
    expect(within(notes).queryByText('Great start. Setup done and you reported on time.')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show all 5 weeks' }))
    expect(
      within(screen.getByRole('list', { name: 'Mentor feedback by week' })).getByText(
        'Great start. Setup done and you reported on time.',
      ),
    ).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: /Assignment submission status/ })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Quiz accuracy by module' })).toHaveTextContent('No scored answers')
  })

  it('the AI being off says so in its own card and keeps the page; Regenerate asks for a fresh summary', async () => {
    vi.mocked(fetchAiSummary).mockRejectedValueOnce(new ApiError(503, 'service_unavailable', 'off'))
    const user = userEvent.setup()
    open('/admin/analytics/students/1')
    const summary = await panel('AI summary')
    expect(await within(summary).findByText('The AI summary service is not available right now.')).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Mentor feedback by week' })).toBeInTheDocument()

    await user.click(within(summary).getByRole('button', { name: 'Try again' }))
    await user.click(await within(summary).findByRole('button', { name: /Regenerate/ }))
    await waitFor(() =>
      expect(fetchAiSummary).toHaveBeenLastCalledWith('students', 1, { from: undefined, to: undefined, force: true }),
    )
    expect(await within(summary).findByText(/Demo text made by the app/)).toBeInTheDocument()
  })

  it('an unknown student is a not-found page', async () => {
    open('/admin/analytics/students/999999')
    expect(await screen.findByRole('heading', { name: 'Student not found', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to students/ })).toHaveAttribute('href', '/admin/analytics/students')
  })
})

describe('Admin analytics: a mentor', () => {
  it('shows the students’ rating first, then the team as it stands now, the dimensions with their n, and the 1:1s', async () => {
    open('/admin/analytics/mentors/900')
    expect(await screen.findByRole('heading', { name: 'Rashad Aliyev', level: 1 })).toBeInTheDocument()
    const top = await glance()
    await waitFor(() => expect(top).toHaveTextContent(/Well rated|Mixed ratings|Poorly rated/))
    expect(
      within(top).getByRole('img', { name: /^Overall ratings: \d+ rated 4–5, \d+ rated 3, \d+ rated 1–2 of \d+$/ }),
    ).toBeInTheDocument()

    const team = await screen.findByRole('list', { name: 'Team members' })
    expect(within(team).getByRole('link', { name: 'Sam Student' })).toHaveAttribute('href', '/admin/analytics/students/1')
    expect(within(team).getAllByRole('listitem')).toHaveLength(5)

    const dims = await screen.findByRole('table', { name: 'Student feedback by dimension' })
    expect(within(dims).getByRole('rowheader', { name: 'Time management' })).toBeInTheDocument()
    expect(screen.getByText(/Uses the mentor's current team/)).toBeInTheDocument()
    expect(
      within(await panel('1:1 sessions')).getByRole('img', { name: /^Weeks with a 1:1: \d+ had a 1:1, \d+ no 1:1 of \d+$/ }),
    ).toBeInTheDocument()
  })
})

describe('Admin analytics: a lecturer', () => {
  it('the Lecturers tab lists every lecturer; a lecturer page shows the ratings, pace and every lecture', async () => {
    const user = userEvent.setup()
    open('/admin/analytics/lecturers')
    const list = await screen.findByRole('list', { name: 'Lecturers' })
    expect(
      within(list)
        .getAllByRole('link')
        .map((l) => l.querySelector('.analytics-people__name')?.textContent),
    ).toEqual(['Elvin Huseynov', 'Nargiz Abbasova', 'Rashad Aliyev'])
    await user.click(within(list).getByRole('link', { name: /Elvin Huseynov/ }))

    expect(await screen.findByRole('heading', { name: 'Elvin Huseynov', level: 1 })).toBeInTheDocument()
    const top = await glance()
    await waitFor(() =>
      expect(within(top).getByRole('img', { name: /^Overall lecture ratings: \d+ rated 4–5/ })).toBeInTheDocument(),
    )
    expect(await screen.findByRole('table', { name: 'Lecture scores' })).toBeInTheDocument()
    expect(
      within(await panel('Pace')).getByRole('img', { name: /^Pace: \d+ too slow, \d+ just right, \d+ too fast of \d+$/ }),
    ).toBeInTheDocument()
    const lectures = screen.getByRole('table', { name: 'Every rated lecture, newest first' })
    expect(within(lectures).getAllByRole('row').length).toBeGreaterThan(1)
    expect(fetchAiSummary).toHaveBeenCalledWith('lecturers', 902, expect.anything())
  })

  it('a server without the lecturer summary says so plainly, and the rest still works', async () => {
    vi.mocked(fetchAiSummary).mockRejectedValueOnce(new ApiError(404, 'error', 'Something went wrong'))
    open('/admin/analytics/lecturers/902')
    const summary = await panel('AI summary')
    expect(await within(summary).findByText(/The server cannot write lecturer summaries yet/)).toBeInTheDocument()
    expect(within(summary).queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(await screen.findByRole('table', { name: 'Every rated lecture, newest first' })).toBeInTheDocument()
  })

  it('an unknown lecturer is a not-found page', async () => {
    open('/admin/analytics/lecturers/4242')
    expect(await screen.findByRole('heading', { name: 'Lecturer not found', level: 1 })).toBeInTheDocument()
  })
})
