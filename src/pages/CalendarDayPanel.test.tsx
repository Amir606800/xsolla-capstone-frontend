import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'

const LECTURER = { id: 901, name: 'Lena Lecturer', email: 'lena@xsolla.school', roles: ['lecturer'] }
const MENTOR = { id: 902, name: 'Marat Mentor', email: 'marat@xsolla.school', roles: ['mentor'] }
const BOTH = { id: 900, name: 'Rashad Aliyev', email: 'rashad@xsolla.school', roles: ['mentor', 'lecturer'] }

vi.setConfig({ testTimeout: 20_000 })

async function open(who: object) {
  localStorage.setItem('auth_user', JSON.stringify(who))
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/calendar' })
  const panel = await screen.findByRole('region', { name: 'Day details' })
  return { user, panel: within(panel) }
}

describe('the staff day panel: what is on the day, and what can be added', () => {
  it('is two parts: "On this day" first, then "Add to this day" with one choice per thing the role can add', async () => {
    const { panel } = await open(BOTH)
    const headings = panel.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings.slice(0, 2)).toEqual(['On this day', 'Add to this day'])
    expect(panel.getByRole('button', { name: 'Add a lecture or event' })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Add 1:1 times' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a lecturer can add lectures and events, but has no 1:1 times', async () => {
    const { panel } = await open(LECTURER)
    expect(panel.getByRole('button', { name: 'Add a lecture or event' })).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: 'Add 1:1 times' })).not.toBeInTheDocument()
  })

  it('a mentor can add 1:1 times, but no lectures', async () => {
    const { panel } = await open(MENTOR)
    expect(panel.getByRole('button', { name: 'Add 1:1 times' })).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: 'Add a lecture or event' })).not.toBeInTheDocument()
  })

  it('a choice opens its form in place of the choices; Cancel brings the choices back', async () => {
    const { user, panel } = await open(BOTH)
    await user.click(panel.getByRole('button', { name: 'Add a lecture or event' }))
    expect(panel.getByRole('heading', { name: 'New lecture or event' })).toBeInTheDocument()
    expect(panel.getByRole('form', { name: 'New event' })).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: 'Add 1:1 times' })).not.toBeInTheDocument()
    // the events of the day stay in view above the form
    expect(panel.getByRole('heading', { name: 'On this day' })).toBeInTheDocument()

    await user.click(panel.getByRole('button', { name: 'Cancel' }))
    expect(panel.getByRole('heading', { name: 'Add to this day' })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Add 1:1 times' })).toBeInTheDocument()

    await user.click(panel.getByRole('button', { name: 'Add 1:1 times' }))
    expect(panel.getByRole('heading', { name: 'Add 1:1 times' })).toBeInTheDocument()
    expect(panel.getByLabelText('From')).toBeInTheDocument()
  })

  it('moving to another day drops a half-filled form and the old message', async () => {
    const { user, panel } = await open(BOTH)
    await user.click(panel.getByRole('button', { name: 'Add a lecture or event' }))
    await user.type(panel.getByLabelText('Title'), 'Draft')
    const grid = screen.getByRole('group', { name: 'Month view' })
    await user.click(within(grid).getByRole('button', { name: /^Monday, November 16/ }))
    expect(panel.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(panel.getByRole('heading', { name: 'Monday, November 16', level: 2 })).toBeInTheDocument()
    expect(panel.getByRole('heading', { name: 'Add to this day' })).toBeInTheDocument()
  })
})
