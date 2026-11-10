import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as directory from '../../api/directory'
import App from '../../App'
import { ADMIN_SECTIONS } from '../../config/adminNav'
import { listModules } from '../../mocks/contentEdits'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

/** Sections that have their real page already. */
const BUILT = ['/admin/modules', '/admin/calendar', '/admin/students', '/admin/mentors', '/admin/lecturers', '/admin/teams', '/admin/announce', '/admin/notifications', '/admin/settings']

const tiles = () => screen.findByRole('list', { name: 'School at a glance' })
const tileFor = async (label: string) => within(await tiles()).getByRole('link', { name: new RegExp(`^${label}`) })

describe('Admin dashboard frame', () => {
  it('lists every section in the sidebar, grouped', async () => {
    renderWithProviders(<App />, { route: '/admin' })
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent?.trim().replace(/\d+$/, ''))).toEqual([
      'Overview',
      'Modules',
      'Calendar',
      'Students',
      'Mentors',
      'Lecturers',
      'Teams',
      'Announce',
      'Notifications',
      'Settings',
      'Office tour',
      'Slack',
      'GitLab',
    ])
    for (const g of ['Course', 'People', 'Messages', 'Account', 'Community', 'Team tools']) expect(within(nav).getByRole('group', { name: g })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })

  it.each(ADMIN_SECTIONS.map((s) => [s.label, s.path]))('opens %s from the sidebar', async (label, path) => {
    renderWithProviders(<App />, { route: '/admin' })
    const user = userEvent.setup()
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    await user.click(within(nav).getByRole('link', { name: label }))
    expect(await screen.findByRole('heading', { name: label, level: 1 })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
    if (!BUILT.includes(path)) expect(screen.getByText('This section is not built yet.')).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', path)
  })
})

describe('Admin overview', () => {
  it('shows the school at a glance from the demo data', async () => {
    renderWithProviders(<App />, { route: '/admin' })
    expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument()
    expect(await tileFor('Modules')).toHaveTextContent(String(listModules().length))
    expect(await tileFor('Students')).toHaveTextContent('29All are in a team')
    expect(await tileFor('Mentors')).toHaveTextContent('61 also lectures')
    expect(await tileFor('Lecturers')).toHaveTextContent('31 also mentors')
    expect(await tileFor('Teams')).toHaveTextContent('64–5 students each')
    expect(await tileFor('Calendar')).toHaveTextContent(/Next: |Nothing planned/)
  })

  it('each tile opens its section', async () => {
    renderWithProviders(<App />, { route: '/admin' })
    const user = userEvent.setup()
    await user.click(await tileFor('Teams'))
    expect(await screen.findByRole('heading', { name: 'Teams', level: 1 })).toBeInTheDocument()
  })

  it('when one source fails only its tiles say so', async () => {
    vi.spyOn(directory, 'fetchUsers').mockRejectedValueOnce(new Error('404 page not found'))
    renderWithProviders(<App />, { route: '/admin' })
    expect(await tileFor('Students')).toHaveTextContent('—Could not load')
    expect(await tileFor('Mentors')).toHaveTextContent('Could not load')
    expect(await tileFor('Teams')).toHaveTextContent('6')
    expect(await tileFor('Modules')).not.toHaveTextContent('Could not load')
  })
})

describe('Admin overview: the current week', () => {
  it('shows this week’s module: lecturer, lectures with their times, tasks with deadlines', async () => {
    renderWithProviders(<App />, { route: '/admin' })
    const card = within(await screen.findByRole('region', { name: 'Current week' }))
    expect(card.getByText('This week')).toBeInTheDocument()
    expect(card.getByRole('heading', { name: 'Week 6 · Go Basics' })).toBeInTheDocument()
    expect(card.getByText(/day \d of 7/)).toBeInTheDocument()
    // week 6 is Elvin's
    expect(card.getByText('Elvin Huseynov')).toBeInTheDocument()
    expect(card.getByText(/2 tasks · \d+ resources? · \d+ quiz/)).toBeInTheDocument()

    const events = within(card.getByRole('list', { name: 'Events this week' }))
    expect(events.getByText('Lecture')).toBeInTheDocument()
    expect(events.getByText('10:00–12:00', { exact: false })).toBeInTheDocument()
    expect(events.getByText('Main hall')).toBeInTheDocument()

    const tasks = within(card.getByRole('list', { name: 'Tasks of the week' }))
    expect(tasks.getByText('CLI tool')).toBeInTheDocument()
    expect(tasks.getByText('HTTP server')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Open module' })).toHaveAttribute('href', '/admin/modules/m6')
  })

  it('says so, with a way to fix it, when the week has no lecturer', async () => {
    const { putModule } = await import('../../mocks/contentEdits')
    putModule('m6', { createdBy: null })
    renderWithProviders(<App />, { route: '/admin' })
    const card = within(await screen.findByRole('region', { name: 'Current week' }))
    expect(card.getByText('No lecturer yet')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Assign one' })).toHaveAttribute('href', '/admin/lecturers')
  })
})
