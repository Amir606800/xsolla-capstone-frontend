import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

function renderApp() {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )
  return renderWithProviders(<App />, { route: '/dashboard' })
}

const sidebar = () => screen.getByRole('complementary', { name: 'Sidebar' })

describe('Sidebar collapse', () => {
  it('is expanded by default', async () => {
    renderApp()
    await screen.findByRole('link', { name: 'Dashboard' })
    expect(sidebar()).not.toHaveClass('is-collapsed')
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-controls', 'app-sidebar')
  })

  it('collapses and expands, flipping the toggle label and aria-expanded', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))

    expect(sidebar()).toHaveClass('is-collapsed')
    const toggle = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(sidebar()).not.toHaveClass('is-collapsed')
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
  })

  it('keeps every link reachable by name and shows a tooltip only while collapsed', async () => {
    const user = userEvent.setup()
    renderApp()
    const labels = ['Dashboard', 'My courses', 'Tasks', 'Calendar', 'Grades', 'My team']

    for (const l of labels) {
      expect(await screen.findByRole('link', { name: l })).not.toHaveAttribute('title')
    }

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    for (const l of labels) {
      expect(screen.getByRole('link', { name: l })).toHaveAttribute('title', l)
    }
  })

  it('still navigates while collapsed and highlights the active link', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    await user.click(screen.getByRole('link', { name: 'Grades' }))

    expect(await screen.findByRole('heading', { name: 'Coming soon' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Grades' })).toHaveClass('is-active')
    expect(sidebar()).toHaveClass('is-collapsed')
  })

  it('remembers the choice across visits', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    expect(localStorage.getItem('sidebar')).toBe('collapsed')
    first.unmount()

    renderApp()
    await screen.findByRole('link', { name: 'Dashboard' })
    expect(sidebar()).toHaveClass('is-collapsed')
  })

  it('ignores a corrupt stored value', async () => {
    localStorage.setItem('sidebar', 'wide')
    renderApp()
    await screen.findByRole('link', { name: 'Dashboard' })
    expect(sidebar()).not.toHaveClass('is-collapsed')
  })
})
