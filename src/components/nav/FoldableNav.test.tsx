import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

/**
 * jsdom has no layout, so the menu's size is given: every element is 100px tall and the menu has `room` pixels. The admin
 * menu (a link, six groups, the tools) then needs about 800px.
 */
function giveRoom(room: number) {
  const size = (name: 'clientHeight' | 'offsetHeight' | 'scrollHeight', value: (el: HTMLElement) => number) =>
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: function (this: HTMLElement) { return value(this) } })
  size('clientHeight', (el) => (el.classList.contains('admin-nav') || el.classList.contains('sidebar') ? room : 0))
  size('offsetHeight', () => 100)
  size('scrollHeight', () => 100)
}

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})
afterEach(() => {
  for (const name of ['clientHeight', 'offsetHeight', 'scrollHeight']) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
})

const nav = async () => within(await screen.findByRole('navigation', { name: 'Admin sections' }))

describe('the admin menu folds only when it does not fit', () => {
  it('fits: every group is open and the headings are plain text, nothing to click', async () => {
    giveRoom(5000)
    renderWithProviders(<App />, { route: '/admin/teams' })
    const menu = await nav()
    expect(await screen.findByRole('link', { name: 'Mentor reviews' })).toBeVisible()
    for (const g of ['Course', 'People', 'Feedback', 'Messages', 'Community']) {
      expect(menu.queryByRole('button', { name: g })).toBeNull()
      expect(menu.getByRole('group', { name: g })).toBeInTheDocument()
    }
    expect(menu.getByRole('link', { name: 'Modules' }).closest('[data-fold-body]')).not.toHaveAttribute('inert')
  })

  it('too tall: the headings become buttons, and only the group of the current page is open', async () => {
    giveRoom(300)
    renderWithProviders(<App />, { route: '/admin/teams' })
    const menu = await nav()
    expect(await menu.findByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'true')
    for (const g of ['Course', 'Feedback', 'Messages', 'Community']) {
      expect(menu.getByRole('button', { name: g })).toHaveAttribute('aria-expanded', 'false')
    }
    // a folded group is out of the tab order, the open one is not
    expect(menu.getByRole('link', { name: 'Modules', hidden: true }).closest('[data-fold-body]')).toHaveAttribute('inert')
    expect(menu.getByRole('link', { name: 'Teams' }).closest('[data-fold-body]')).not.toHaveAttribute('inert')
    // the overview and the tools are not in a group: always there
    expect(menu.getByRole('link', { name: 'Overview' })).toBeInTheDocument()
    expect(menu.getByRole('link', { name: /Slack/ })).toBeInTheDocument()
  })

  it('a click opens a folded group and folds an open one; the choice is remembered', async () => {
    giveRoom(300)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/teams' })
    const menu = await nav()
    await user.click(await menu.findByRole('button', { name: 'Feedback' }))
    expect(menu.getByRole('button', { name: 'Feedback' })).toHaveAttribute('aria-expanded', 'true')
    expect(menu.getByRole('link', { name: 'Lecture reviews' }).closest('[data-fold-body]')).not.toHaveAttribute('inert')
    await user.click(menu.getByRole('button', { name: 'People' }))
    expect(menu.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'false')
    expect(JSON.parse(localStorage.getItem('admin_nav_fold') ?? 'null')).toEqual(['Course', 'Insights', 'Messages', 'Community', 'People'])
  })

  it('goes back to the choice made earlier', async () => {
    giveRoom(300)
    localStorage.setItem('admin_nav_fold', JSON.stringify(['Course', 'Messages']))
    renderWithProviders(<App />, { route: '/admin/teams' })
    const menu = await nav()
    expect(await menu.findByRole('button', { name: 'Feedback' })).toHaveAttribute('aria-expanded', 'true')
    expect(menu.getByRole('button', { name: 'Course' })).toHaveAttribute('aria-expanded', 'false')
    expect(menu.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('going to a page in a folded group, by a link elsewhere, opens that group', async () => {
    giveRoom(300)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/teams' })
    const menu = await nav()
    expect(await menu.findByRole('button', { name: 'Course' })).toHaveAttribute('aria-expanded', 'false')
    // the overview's tiles are a way in that is not the menu
    await user.click(menu.getByRole('link', { name: 'Overview' }))
    const tiles = within(await screen.findByRole('list', { name: 'School at a glance' }))
    await user.click(tiles.getByRole('link', { name: /^Modules/ }))
    expect(await screen.findByRole('heading', { name: 'Modules', level: 1 })).toBeInTheDocument()
    expect(menu.getByRole('button', { name: 'Course' })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('the main sidebar folds its headed groups the same way', () => {
  const student = () => localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', roles: ['student'] }))
  const sidebar = async () => within(await screen.findByRole('complementary', { name: 'Sidebar' }))

  it('fits: the COMMUNITY heading is plain text and its links are there', async () => {
    student()
    giveRoom(5000)
    renderWithProviders(<App />, { route: '/dashboard' })
    const menu = await sidebar()
    expect(menu.queryByRole('button', { name: 'COMMUNITY' })).toBeNull()
    expect(menu.getByRole('link', { name: 'Office tour' })).toBeInTheDocument()
  })

  it('too tall: COMMUNITY becomes a button that opens and folds Office tour; the main links never fold', async () => {
    student()
    giveRoom(200)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    const menu = await sidebar()
    const heading = await menu.findByRole('button', { name: 'COMMUNITY' })
    expect(heading).toHaveAttribute('aria-expanded', 'false')
    expect(menu.getByRole('link', { name: 'Office tour', hidden: true }).closest('[data-fold-body]')).toHaveAttribute('inert')
    expect(menu.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument() // the first group has no heading
    await user.click(heading)
    expect(heading).toHaveAttribute('aria-expanded', 'true')
    expect(menu.getByRole('link', { name: 'Office tour' }).closest('[data-fold-body]')).not.toHaveAttribute('inert')
  })
})
