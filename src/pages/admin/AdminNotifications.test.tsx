import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { putModule } from '../../mocks/contentEdits'
import { clearTeams, setLeft, setRoles } from '../../mocks/directory'
import { renderWithProviders } from '../../test/renderWithProviders'

// Wed 4 Nov 2026, 12:00: the demo lectures are on Mondays, so none starts within 48 hours
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})
afterEach(() => vi.useRealTimers())

const needs = async () => within(await screen.findByRole('list', { name: 'Needs attention' }))
const nav = async () => within(await screen.findByRole('navigation', { name: 'Admin sections' }))

describe('Admin: notifications', () => {
  it('a school with nothing wrong says so', async () => {
    renderWithProviders(<App />, { route: '/admin/notifications' })
    expect(await screen.findByRole('heading', { name: 'Notifications', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('Nothing needs your attention.')).toBeInTheDocument()
    expect(screen.getByText('Nothing new in the last week.')).toBeInTheDocument()
    // and no count on the sidebar
    expect(within(await screen.findByRole('link', { name: 'Notifications' })).queryByText(/\d/)).toBeNull()
  })

  it('lists what is wrong, each with the page that fixes it; the sidebar counts them', async () => {
    putModule('m6', { lecturerIds: [] }) // this week has no lecturer
    clearTeams() // and there are no teams
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const list = await needs()
    const items = list.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Week 6 (Go Basics) has no lecturer')).toBeInTheDocument()
    expect(within(items[0]).getByRole('link', { name: 'Assign a lecturer' })).toHaveAttribute('href', '/admin/lecturers')
    expect(within(items[1]).getByText('There are no teams yet')).toBeInTheDocument()
    expect(within(items[1]).getByRole('link', { name: 'Create teams' })).toHaveAttribute('href', '/admin/teams')
    expect(screen.getByRole('heading', { name: 'Needs attention (2)' })).toBeInTheDocument()
    expect(await screen.findByLabelText('2 need attention')).toHaveTextContent('2')
  })

  it('an item goes away once it is fixed: Refresh looks again', async () => {
    putModule('m6', { lecturerIds: [] })
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/notifications' })
    expect(await screen.findByText('Week 6 (Go Basics) has no lecturer')).toBeInTheDocument()
    putModule('m6', { lecturerIds: [902] })
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('Nothing needs your attention.')).toBeInTheDocument()
  })

  it('moving to another page looks again, so the count follows what was done there', async () => {
    putModule('m6', { lecturerIds: [] })
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin' })
    expect(await screen.findByLabelText('1 need attention')).toBeInTheDocument()
    putModule('m6', { lecturerIds: [902] })
    await user.click((await nav()).getByRole('link', { name: 'Students' }))
    await screen.findByRole('table', { name: 'Students' })
    expect(screen.queryByLabelText(/need attention/)).toBeNull()
  })

  it('lately: a student who left, and a role that ends soon', async () => {
    setLeft(121, true, new Date(2026, 10, 2))
    setRoles(901, ['mentor', 'lecturer'], { lecturer: new Date(2026, 10, 9, 23, 59).toISOString() })
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const lately = within(await screen.findByRole('list', { name: 'Lately' }))
    expect(lately.getByText('Ali Abbasov left the school')).toBeInTheDocument()
    expect(lately.getByText('Aysel Mammadova’s lecturer role ends in 5 days')).toBeInTheDocument()
  })

  it('every notification links to the page that deals with it', async () => {
    clearTeams()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/notifications' })
    await user.click((await needs()).getByRole('link', { name: 'Create teams' }))
    expect(await screen.findByRole('heading', { name: 'Teams', level: 1 })).toBeInTheDocument()
  })
})
