import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchReports } from '../../api/reports'
import App from '../../App'
import { addReport } from '../../mocks/reports'
import { clearFilters, pickFilter } from '../../test/filters'
import { renderWithProviders } from '../../test/renderWithProviders'

// the demo reports are the default (two open, one resolved); a test can make the server answer differently
vi.mock('../../api/reports', async (importActual) => {
  const actual = await importActual<typeof import('../../api/reports')>()
  return { ...actual, fetchReports: vi.fn(actual.fetchReports) }
})

beforeEach(() => {
  vi.mocked(fetchReports).mockClear()
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }),
  )
})

const open = () => renderWithProviders(<App />, { route: '/admin/reports' })
const list = () => screen.findByRole('list', { name: 'Reports' })
const card = async (title: string) => (await screen.findByRole('heading', { name: title, level: 3 })).closest('li') as HTMLElement
const statusTab = (name: RegExp) => within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name })

describe('Admin: reports', () => {
  it('is under Messages in the sidebar, with the number of open reports, and lists the open ones first', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin' })
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    const link = await within(nav).findByRole('link', { name: 'Reports, 2 open' })
    expect(within(nav).getByRole('group', { name: 'Messages' })).toContainElement(link)
    await user.click(link)

    expect(await screen.findByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument()
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(2)
    expect(statusTab(/^Open/)).toHaveTextContent('2')
    expect(statusTab(/^Resolved/)).toHaveTextContent('1')

    // what it is about and who come from the subject; the message is shown without its "About:" line
    const missed = await card('Missed two 1:1s')
    expect(missed).toHaveTextContent('A mentor')
    expect(missed).toHaveTextContent('Rashad Aliyev')
    expect(missed).toHaveTextContent('From Leyla Hasanova (Student)')
    expect(missed).toHaveTextContent('Our last two 1:1s did not happen')
    expect(missed).not.toHaveTextContent('About:')
    expect(missed).toHaveTextContent('Open')
  })

  it('marks a report resolved with a note, shows it under Resolved, and can open it again', async () => {
    const user = userEvent.setup()
    open()
    const missed = await card('Missed two 1:1s')
    await user.click(within(missed).getByRole('button', { name: 'Add note' }))
    await user.type(within(missed).getByLabelText('Admin note'), 'Talked to Rashad: the 1:1s are back on.')
    await user.click(within(missed).getByRole('button', { name: 'Save note' }))
    // saved: the note shows on the card and the form closes
    expect(
      await within(missed).findByText('Talked to Rashad: the 1:1s are back on.', { selector: 'blockquote' }),
    ).toBeInTheDocument()

    await user.click(within(missed).getByRole('button', { name: 'Mark resolved' }))
    // it leaves the open list
    expect(await screen.findByText(/^1 report, newest first/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Missed two 1:1s' })).toBeNull()

    await user.click(statusTab(/^Resolved/))
    const done = await card('Missed two 1:1s')
    expect(done).toHaveTextContent('Resolved by School Admin')
    expect(done).toHaveTextContent('Talked to Rashad: the 1:1s are back on.')
    await user.click(within(done).getByRole('button', { name: 'Open again' }))
    await user.click(statusTab(/^Open/))
    expect(await card('Missed two 1:1s')).toHaveTextContent('Open')
  })

  it('deletes a report after asking', async () => {
    const user = userEvent.setup()
    open()
    const copied = await card('Copied the HTTP server task')
    await user.click(within(copied).getByRole('button', { name: 'Delete' }))
    const ask = screen.getByRole('dialog', { name: 'Delete this report?' })
    await user.click(within(ask).getByRole('button', { name: 'Delete report' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Copied the HTTP server task' })).toBeNull())
    expect(statusTab(/^Open/)).toHaveTextContent('1')
  })

  it('filters by who sent it and searches; a report sent meanwhile shows up by itself', async () => {
    const user = userEvent.setup()
    open()
    await list()
    await pickFilter(user, 'Sent by', 'Mentors')
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(1)
    expect(await card('Copied the HTTP server task')).toBeInTheDocument()
    await clearFilters(user)

    await user.type(screen.getByRole('searchbox', { name: 'Search reports' }), 'heating')
    expect(await screen.findByText('No reports match.')).toBeInTheDocument()
    await user.click(statusTab(/^All/))
    expect(await card('No heating in room 3')).toHaveTextContent('The heating was repaired on Tuesday.')
    await user.clear(screen.getByRole('searchbox', { name: 'Search reports' }))

    act(() => {
      addReport('A student: Ali Abbasov · Rude in the team chat', 'About: A student (Ali Abbasov)\n\nHe insulted a teammate.', {
        id: 122,
        name: 'Banu Hajiyeva',
        roles: ['student'],
      })
    })
    expect(await card('Rude in the team chat')).toHaveTextContent('From Banu Hajiyeva (Student)')
  })

  it('a server without the report routes says so, plainly', async () => {
    vi.mocked(fetchReports).mockResolvedValueOnce(null)
    open()
    expect(await screen.findByText('The server cannot list the reports yet.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
