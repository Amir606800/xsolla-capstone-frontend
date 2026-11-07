import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

/** The text of one column, top to bottom. */
async function column(tableName: string, index: number) {
  const table = await screen.findByRole('table', { name: tableName })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[index].textContent ?? '')
}
const header = (table: HTMLElement, name: string) => within(table).getByRole('columnheader', { name })

describe('Sorting admin tables by their column names', () => {
  it('students: by name at first; by team (A-Z, then Z-A) with a click', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const table = await screen.findByRole('table', { name: 'Students' })
    expect(header(table, 'Name')).toHaveAttribute('aria-sort', 'ascending')
    const names = await column('Students', 0)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))

    await user.click(within(table).getByRole('button', { name: 'Team' }))
    expect(header(table, 'Team')).toHaveAttribute('aria-sort', 'ascending')
    expect(header(table, 'Name')).toHaveAttribute('aria-sort', 'none')
    let teams = await column('Students', 2)
    expect(teams[0]).toBe('Team 1')
    expect(teams.at(-1)).toBe('Team 6')

    await user.click(within(table).getByRole('button', { name: 'Team' }))
    expect(header(table, 'Team')).toHaveAttribute('aria-sort', 'descending')
    teams = await column('Students', 2)
    expect(teams[0]).toBe('Team 6')
    expect(teams.at(-1)).toBe('Team 1')
  })

  it('students: by mentor', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const table = await screen.findByRole('table', { name: 'Students' })
    await user.click(within(table).getByRole('button', { name: 'Mentor' }))
    const mentors = await column('Students', 3)
    expect(mentors[0]).toBe('Aysel Mammadova')
    expect(mentors).toEqual([...mentors].sort((a, b) => a.localeCompare(b)))
  })

  it('mentors: by team and by roles', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    const table = await screen.findByRole('table', { name: 'Mentors' })
    await user.click(within(table).getByRole('button', { name: 'Team' }))
    expect((await column('Mentors', 2)).map((t) => t.split(' · ')[0])).toEqual(['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6'])
    await user.click(within(table).getByRole('button', { name: 'Roles' }))
    await user.click(within(table).getByRole('button', { name: 'Roles' }))
    // descending: the mentor who also lectures comes first
    expect((await column('Mentors', 0))[0]).toBe('Rashad Aliyev')
  })

  it('modules: by number at first; by lecturer and by status', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    const table = await screen.findByRole('table', { name: 'Modules' })
    expect(await column('Modules', 0)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)))
    await user.click(within(table).getByRole('button', { name: '#' }))
    expect((await column('Modules', 0))[0]).toBe('12')

    await user.click(within(table).getByRole('button', { name: 'Status' }))
    const statuses = await column('Modules', 5)
    expect(statuses[0]).toBe('Running now')
    expect(statuses.at(-1)).toBe('Finished')

    await user.click(within(table).getByRole('button', { name: 'Lecturer' }))
    const lecturers = await within(table).findAllByText(/Elvin Huseynov|Rashad Aliyev/)
    expect(lecturers[0]).toHaveTextContent('Elvin Huseynov')
  })

  it('a module’s contents: by title', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m5' })
    const user = userEvent.setup()
    const table = await screen.findByRole('table', { name: 'Contents of React' })
    // by type at first (no column picked)
    expect(header(table, 'Type')).toHaveAttribute('aria-sort', 'none')
    await user.click(within(table).getByRole('button', { name: 'Title' }))
    const titles = (await column('Contents of React', 1)).map((t) => t.toLowerCase())
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)))
  })

  it('the actions column cannot be sorted', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const table = await screen.findByRole('table', { name: 'Students' })
    expect(within(table).getAllByRole('columnheader').at(-1)).not.toHaveAttribute('aria-sort')
  })
})
