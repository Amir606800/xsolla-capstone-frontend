import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'

function renderAt(route: string) {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )
  return renderWithProviders(<App />, { route })
}

describe('CoursesPage', () => {
  it('lists all 12 modules in order, each linking to its page', async () => {
    renderAt('/courses')
    expect(await screen.findByRole('heading', { name: 'My courses' })).toBeInTheDocument()

    const list = await screen.findByRole('list', { name: 'Modules' })
    const links = within(list).getAllByRole('link')
    expect(links).toHaveLength(12)
    expect(links[0]).toHaveAttribute('href', '/courses/m1')
    expect(links[0]).toHaveTextContent('Module 1')
    expect(links[11]).toHaveAttribute('href', '/courses/m12')
  })

  it('shows each module\'s state: all submitted vs next due (urgent when overdue)', async () => {
    renderAt('/courses')
    const list = await screen.findByRole('list', { name: 'Modules' })
    const cards = within(list).getAllByRole('link')

    expect(within(cards[0]).getByText('All submitted')).toBeInTheDocument()
    expect(within(cards[3]).getByText(/^Next due/)).toHaveClass('pill--danger') // module 4 has an overdue task
    expect(within(cards[11]).getByText(/^Next due/)).not.toHaveClass('pill--danger')
  })

  it('opens the module page when a card is clicked', async () => {
    const user = userEvent.setup()
    renderAt('/courses')
    await user.click(await screen.findByRole('link', { name: /Module 5.*React/ }))
    expect(await screen.findByRole('heading', { name: 'React' })).toBeInTheDocument()
  })

  it('the dashboard path node also leads to the module page, and back works', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard')
    await user.click(await screen.findByRole('link', { name: /^Module 2:/ }))
    expect(await screen.findByRole('heading', { name: 'Web Fundamentals' })).toBeInTheDocument()

    await user.click(within(screen.getByRole('main')).getByRole('link', { name: /My courses/ }))
    expect(await screen.findByRole('heading', { name: 'My courses' })).toBeInTheDocument()
  })
})
