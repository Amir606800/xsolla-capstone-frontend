import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { addBroadcast } from '../mocks/broadcasts'
import { putModule } from '../mocks/contentEdits'
import { renderWithProviders } from '../test/renderWithProviders'

const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }

vi.setConfig({ testTimeout: 20_000 })

/**
 * What one person saves is on everyone's screen at once: no reload, no click. (Here "the server" is the shared offline store, which
 * tells the app the same way a save to the real backend does; the other side is a student who has done nothing.)
 */
describe('a change made elsewhere shows up without a reload', () => {
  it("a lecturer renaming a module is on the student's course list at once", async () => {
    localStorage.setItem('auth_user', JSON.stringify(STUDENT))
    renderWithProviders(<App />, { route: '/courses' })
    const list = await screen.findByRole('list', { name: 'Modules' })
    expect(within(list).queryByText('A brand new title')).toBeNull()

    putModule('m1', { title: 'A brand new title' })

    // the course is loaded again together with the student's 1:1s (their deadlines follow them)
    expect(await within(list).findByText('A brand new title', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it("an admin's announcement rings the student's bell at once", async () => {
    localStorage.setItem('auth_user', JSON.stringify(STUDENT))
    renderWithProviders(<App />, { route: '/courses' })
    const bell = await screen.findByRole('button', { name: /^Notifications, \d+ unread/ })
    const before = Number(/(\d+) unread/.exec(bell.getAttribute('aria-label') ?? '')?.[1])

    addBroadcast({ message: 'Office closed on Friday', link: '', audience: 'all' }, 1, 'Admin')

    expect(await screen.findByRole('button', { name: `Notifications, ${before + 1} unread` })).toBeInTheDocument()
  })
})
