import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { putEvent } from '../mocks/contentEdits'
import { renderWithProviders } from '../test/renderWithProviders'

const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }

vi.setConfig({ testTimeout: 20_000 })

describe('the calendar stays up to date by itself', () => {
  it('an event a lecturer adds while a student has the calendar open shows up when the student comes back to the tab', async () => {
    localStorage.setItem('auth_user', JSON.stringify(STUDENT))
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/calendar' })
    const grid = await screen.findByRole('group', { name: 'Month view' })
    const now = new Date()
    const day = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 1, 28))
    const at = (h: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).toISOString()
    const label = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    await user.click(within(grid).getByRole('button', { name: new RegExp(`^${label}`) }))
    expect(screen.queryByText('Fresh from the lecturer')).toBeNull()

    // the lecturer saves a new event (on the same server in real life; here the shared store)
    putEvent({ id: 'ev-fresh', title: 'Fresh from the lecturer', kind: 'lecture', startsAt: at(10), endsAt: at(11) })
    // nothing yet: the student has not done anything
    expect(screen.queryByText('Fresh from the lecturer')).toBeNull()

    // the student comes back to the tab
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect((await screen.findAllByText('Fresh from the lecturer')).length).toBeGreaterThan(0)
  })
})
