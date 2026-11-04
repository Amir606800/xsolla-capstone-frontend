import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchModules } from '../api/courses'
import { CoursesProvider } from '../context/CoursesProvider'
import { renderWithProviders } from '../test/renderWithProviders'
import DashboardPage from './DashboardPage'

function renderDashboard() {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )
  return renderWithProviders(
    <CoursesProvider>
      <DashboardPage />
    </CoursesProvider>,
  )
}

describe('DashboardPage', () => {
  it('greets the user and shows a loading state first', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('renders progress, the module path, deadlines and grades once loaded', async () => {
    renderDashboard()
    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Course modules' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^Module \d+:/ })).toHaveLength(12)
    expect(screen.getByRole('heading', { name: 'Upcoming deadlines' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent grades' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Quizzes' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
