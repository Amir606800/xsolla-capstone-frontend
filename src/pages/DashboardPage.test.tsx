import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchModules } from '../api/courses'
import { CoursesProvider } from '../context/CoursesProvider'
import { DashboardLayoutProvider } from '../context/DashboardLayoutProvider'
import { StandingsProvider } from '../context/StandingsProvider'
import { renderWithProviders } from '../test/renderWithProviders'
import DashboardPage from './DashboardPage'

function renderDashboard() {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )
  return renderWithProviders(
    <CoursesProvider>
      <DashboardLayoutProvider>
        <StandingsProvider>
          <DashboardPage />
        </StandingsProvider>
      </DashboardLayoutProvider>
    </CoursesProvider>,
  )
}

describe('DashboardPage', () => {
  it('greets the user and shows a loading state first', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('while loading it shows grey placeholder cards, not a blank page, and they are gone when the data is in', async () => {
    const { container } = renderDashboard()
    const busy = screen.getByRole('status')
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveClass('skeleton-dash')
    expect(container.querySelectorAll('.skeleton-card').length).toBeGreaterThanOrEqual(5)
    // a screen reader hears one sentence, not the empty boxes
    expect(container.querySelectorAll('.skeleton-card[aria-hidden="true"]')).toHaveLength(container.querySelectorAll('.skeleton-card').length)
    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument()
    expect(container.querySelector('.skeleton-dash')).toBeNull()
  })

  it('renders progress, the module path, deadlines and grades once loaded', async () => {
    renderDashboard()
    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Course modules' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^Module \d+:/ })).toHaveLength(6) // open modules
    expect(screen.getAllByRole('group', { name: /^Module \d+:.*locked/ })).toHaveLength(6) // future modules
    expect(screen.getByRole('heading', { name: 'Upcoming deadlines' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent grades' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Current task' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Quizzes' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not list tasks of modules that are not open yet under upcoming deadlines', async () => {
    renderDashboard()
    await screen.findByRole('heading', { name: 'Progress' })
    const card = screen.getByRole('heading', { name: 'Upcoming deadlines' }).closest('section')!
    // module 7+ tasks (e.g. "Schema design") must stay hidden from a student
    expect(card).not.toHaveTextContent('Schema design')
    expect(card).not.toHaveTextContent('Docker')
  })

  it('shows the open path to a teacher: nothing is locked', async () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Lec', email: 'l@x.co', role: 'teacher' }))
    renderWithProviders(
      <CoursesProvider>
        <DashboardLayoutProvider>
          <StandingsProvider>
            <DashboardPage />
          </StandingsProvider>
        </DashboardLayoutProvider>
      </CoursesProvider>,
    )
    await screen.findByRole('heading', { name: 'Progress' })
    expect(screen.getAllByRole('link', { name: /^Module \d+:/ })).toHaveLength(12)
    expect(screen.queryByRole('group', { name: /locked/ })).not.toBeInTheDocument()
  })

  it('shows an error with retry, and recovers', async () => {
    vi.mocked(fetchModules).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderDashboard()

    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load")
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument()
  })

  it('fetches the course once per shell, not on every render', async () => {
    vi.mocked(fetchModules).mockClear()
    renderDashboard()
    await screen.findByRole('heading', { name: 'Progress' })
    expect(fetchModules).toHaveBeenCalledTimes(1)
  })
})
