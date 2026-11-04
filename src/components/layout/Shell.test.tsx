import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

function renderApp(route = '/dashboard', role: 'student' | 'teacher' = 'student') {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role }))
  return renderWithProviders(<App />, { route })
}

describe('Current module chip in the header', () => {
  it('links to the module that is running now and shows its next deadline', async () => {
    renderApp()
    const chip = await screen.findByRole('link', { name: 'Current module: Go Basics' })
    expect(chip).toHaveAttribute('href', '/courses/m6')
    expect(chip).toHaveTextContent('Module 6 · Go Basics')
    expect(chip).toHaveTextContent(/Next due in \d+ (days?|hours?)/)
    expect(chip.closest('header')).not.toBeNull()
  })

  it('opens that module when clicked', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('link', { name: /Current module/ }))
    expect(await screen.findByRole('heading', { name: 'Go Basics', level: 1 })).toBeInTheDocument()
  })

  it('is there on every page of the app, not just the dashboard', async () => {
    renderApp('/calendar')
    expect(await screen.findByRole('link', { name: /Current module/ })).toBeInTheDocument()
  })
})

describe('Sidebar: program progress card', () => {
  it('shows how far into the program we are', async () => {
    renderApp()
    const bar = await screen.findByRole('progressbar', { name: 'Program progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '6') // modules 1-6 have opened
    expect(bar).toHaveAttribute('aria-valuemax', '12')
    expect(bar).toHaveAttribute('aria-valuetext', 'Week 6 of 12')
    expect(screen.getByText('Week 6 of 12')).toBeInTheDocument()
  })

  it('shows the same for a teacher (it is about the calendar, not about access)', async () => {
    renderApp('/dashboard', 'teacher')
    expect(await screen.findByText('Week 6 of 12')).toBeInTheDocument()
  })

  it('stays inside the sidebar and is hidden by CSS when the rail is collapsed', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('Week 6 of 12')
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('is-collapsed')
  })
})

describe('Sidebar links', () => {
  it('give each icon its own tile and keep their accessible names', async () => {
    renderApp()
    const link = await screen.findByRole('link', { name: 'Calendar' })
    expect(link.querySelector('.sidebar__icon svg')).not.toBeNull()
    for (const name of ['Dashboard', 'My courses', 'Tasks', 'Calendar', 'Grades', 'My team']) {
      expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name })).toBeInTheDocument()
    }
  })
})
