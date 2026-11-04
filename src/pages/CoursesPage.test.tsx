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
  it('lists all 12 modules in order; only the open ones are links', async () => {
    renderAt('/courses')
    expect(await screen.findByRole('heading', { name: 'My courses' })).toBeInTheDocument()

    const list = await screen.findByRole('list', { name: 'Modules' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(12)
    expect(items[0]).toHaveTextContent('Module 1')
    expect(items[11]).toHaveTextContent('Module 12')

    const links = within(list).getAllByRole('link')
    expect(links).toHaveLength(6) // modules 1-6 are open
    expect(links[0]).toHaveAttribute('href', '/courses/m1')
    expect(links[5]).toHaveAttribute('href', '/courses/m6')
  })

  it('shows future modules as locked: no link, an opening date and no details', async () => {
    renderAt('/courses')
    const list = await screen.findByRole('list', { name: 'Modules' })
    const card = within(list).getByLabelText('Module 7: Databases & SQL, locked')

    expect(card).toHaveClass('is-locked')
    expect(card).toHaveTextContent(/Opens [A-Z][a-z]{2} \d+/)
    expect(card.closest('a')).toBeNull()
    expect(card).not.toHaveTextContent('Relational data') // description stays hidden
    expect(card.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('teachers can open every module', async () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Lec', email: 'l@x.co', role: 'teacher' }))
    renderWithProviders(<App />, { route: '/courses' })
    const list = await screen.findByRole('list', { name: 'Modules' })
    expect(within(list).getAllByRole('link')).toHaveLength(12)
  })

  it("shows each open module's state: all submitted vs next due (urgent when overdue)", async () => {
    renderAt('/courses')
    const list = await screen.findByRole('list', { name: 'Modules' })
    const cards = within(list).getAllByRole('link')

    expect(within(cards[0]).getByText('All submitted')).toBeInTheDocument()
    expect(within(cards[3]).getByText(/^Next due/)).toHaveClass('pill--danger') // module 4 has an overdue task
    expect(within(cards[5]).getByText(/^Next due/)).not.toHaveClass('pill--danger') // module 6 is current
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
