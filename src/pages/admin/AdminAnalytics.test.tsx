import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOverview } from '../../api/analytics'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

// the demo analytics are the default; a test can make one request fail
vi.mock('../../api/analytics', async (importActual) => {
  const actual = await importActual<typeof import('../../api/analytics')>()
  return { ...actual, fetchOverview: vi.fn(actual.fetchOverview) }
})

beforeEach(() => {
  vi.mocked(fetchOverview).mockClear()
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const nav = () => screen.findByRole('navigation', { name: 'Admin sections' })

describe('Admin: analytics', () => {
  it('is in the sidebar under Insights and opens the school overview', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin' })
    const links = await nav()
    await user.click(within(links).getByRole('link', { name: 'Analytics' }))

    expect(await screen.findByRole('heading', { name: 'Analytics', level: 1 })).toBeInTheDocument()
    expect(within(links).getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/admin/analytics')
    const table = await screen.findByRole('table', { name: 'Weekly student standing' })
    // every week has a row; the ungraded week says so instead of showing zeroes
    expect(within(table).getAllByRole('row')).toHaveLength(7)
    expect(within(table).getByText('No grades recorded')).toBeInTheDocument()
    // the legend names the three categories, so colour is not the only signal
    const legend = screen.getByRole('list', { name: 'Weekly student standing legend' })
    expect(within(legend).getByText('Green')).toBeInTheDocument()
    expect(within(legend).getByText('Yellow')).toBeInTheDocument()
    expect(within(legend).getByText('Red')).toBeInTheDocument()
    // and the data table carries the exact counts
    expect(within(table).getByRole('rowheader', { name: /Week 1/ })).toBeInTheDocument()
  })

  it('shows a failed request and loads the chart again on retry', async () => {
    vi.mocked(fetchOverview).mockRejectedValueOnce(new Error('Server down'))
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/analytics' })

    expect(await screen.findByText('Server down')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'Weekly student standing' })).toBeInTheDocument()
    expect(screen.queryByText('Server down')).not.toBeInTheDocument()
  })

  it('searches the students on the server and opens one student', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/analytics/students' })
    expect(await screen.findByRole('heading', { name: 'Student analytics', level: 1 })).toBeInTheDocument()

    // the demo lists 24 students, 20 at a time
    const list = await screen.findByRole('list', { name: 'Students' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(20)
    await user.click(screen.getByRole('button', { name: 'Show more students' }))
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Students' })).getAllByRole('listitem')).toHaveLength(24),
    )

    await user.type(screen.getByRole('searchbox', { name: 'Search students' }), 'Leyla')
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Students' })).getAllByRole('listitem')).toHaveLength(1),
    )
    await user.click(screen.getByRole('link', { name: /Leyla Hasanova/ }))

    expect(await screen.findByRole('heading', { name: 'Leyla Hasanova', level: 1 })).toBeInTheDocument()
    const status = await screen.findByRole('table', { name: /Assignment submission status/ })
    expect(within(status).getByRole('rowheader', { name: 'Submitted on time' })).toBeInTheDocument()
    const accuracy = screen.getByRole('table', { name: 'Quiz accuracy by module' })
    expect(within(accuracy).getByRole('rowheader', { name: /Week 1/ })).toBeInTheDocument()
    expect(within(accuracy).getByText('80%')).toBeInTheDocument()
    // a module with no points is named, not drawn as 0%
    expect(within(accuracy).getByText('No scored answers')).toBeInTheDocument()
  })

  it('shows a not-found state for an unknown student', async () => {
    renderWithProviders(<App />, { route: '/admin/analytics/students/999999' })
    expect(await screen.findByRole('heading', { name: 'Student not found', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to students/ })).toHaveAttribute('href', '/admin/analytics/students')
  })

  it('shows each mentor dimension with its own n, and "No responses" when nobody rated it', async () => {
    renderWithProviders(<App />, { route: '/admin/analytics/mentors/902' })
    expect(await screen.findByRole('heading', { name: 'Elvin Huseynov', level: 1 })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Student feedback by dimension' })
    expect(within(table).getAllByText('No responses')).toHaveLength(4)
    expect(within(table).getByRole('rowheader', { name: 'Time management' })).toBeInTheDocument()
    // past weeks are current-roster only, and the page says so
    expect(screen.getByText(/Uses the mentor's current team/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: "The mentor's students by week" })).toBeInTheDocument()
  })

  it('shows a rated mentor on a fixed 1–5 scale with the response count', async () => {
    renderWithProviders(<App />, { route: '/admin/analytics/mentors/900' })
    const table = await screen.findByRole('table', { name: 'Student feedback by dimension' })
    expect(within(table).getByRole('rowheader', { name: 'Clarity' })).toBeInTheDocument()
    expect(within(table).getByText('4.4')).toBeInTheDocument()
    expect(within(table).getAllByText('5').length).toBeGreaterThan(0)
    expect(screen.getByText('4.4 · n=5')).toBeInTheDocument()
  })
})
