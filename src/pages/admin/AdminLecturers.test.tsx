import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { listModules } from '../../mocks/contentEdits'
import { listTeams, listUsers } from '../../mocks/directory'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const table = () => screen.findByRole('table', { name: 'Lecturers' })
const rows = async () => within(await table()).getAllByRole('row').slice(1)
const rowOf = (name: string) => screen.getByRole('cell', { name }).closest('tr')!
const dialog = () => screen.findByRole('dialog')

describe('Admin: lecturers', () => {
  it('lists everyone who lectures, with the modules they wrote and their roles', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    expect(await rows()).toHaveLength(3)
    // Rashad writes the odd weeks (6 of 12), Elvin the even ones
    expect(await within(rowOf('Rashad Aliyev')).findByText('6 modules')).toBeInTheDocument()
    expect(within(rowOf('Rashad Aliyev')).getByText('Mentor')).toBeInTheDocument()
    expect(within(rowOf('Elvin Huseynov')).getByText('6 modules')).toBeInTheDocument()
    expect(within(rowOf('Nargiz Abbasova')).getByText('—')).toBeInTheDocument()
    // a mentor who does not lecture is not here
    expect(screen.queryByRole('cell', { name: 'Aysel Mammadova' })).not.toBeInTheDocument()
    expect(screen.getByText(/3 lecturers · 1 also mentor/)).toBeInTheDocument()
  })

  it('filters: lecturers only, for a while; and searches', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await table()
    const show = within(screen.getByRole('group', { name: 'Show' }))
    await user.click(show.getByRole('button', { name: /^Lecturers only/ }))
    expect(await rows()).toHaveLength(2)
    await user.click(show.getByRole('button', { name: /^For a while/ }))
    expect(screen.getByText('No lecturers match.')).toBeInTheDocument()
    await user.click(show.getByRole('button', { name: /^All/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search lecturers' }), 'nargiz')
    expect(await rows()).toHaveLength(1)
  })

  it('adds a lecturer with a password: lecturer role, no team field', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Add lecturer' }))
    const form = within(await dialog())
    expect(form.queryByLabelText(/Team/)).not.toBeInTheDocument()
    await user.type(form.getByLabelText('Full name'), 'Lea Lecturer')
    await user.type(form.getByLabelText('Email'), 'lea@example.com')
    await user.type(form.getByLabelText('Password'), 'secret123')
    await user.click(form.getByRole('button', { name: 'Add lecturer' }))
    expect(await screen.findByText('Lea Lecturer added as a lecturer. They can sign in with lea@example.com and the password you set.')).toBeInTheDocument()
    expect(within(rowOf('Lea Lecturer')).getByText('Lecturer')).toBeInTheDocument()
    expect(listUsers().find((u) => u.email === 'lea@example.com')!.roles).toEqual(['lecturer'])
  })

  it('edits a name; a mentor who lectures keeps their team', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Edit Rashad Aliyev' }))
    const form = within(await dialog())
    await user.clear(form.getByLabelText('Full name'))
    await user.type(form.getByLabelText('Full name'), 'Rashad Aliev')
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Rashad Aliev: changes saved.')).toBeInTheDocument()
    expect(listTeams().find((t) => t.id === 't3')!.mentorId).toBe(900)
  })

  it('lecturers have no roles dialog: they stay lecturers', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    await table()
    expect(screen.queryByRole('button', { name: /^Roles of / })).not.toBeInTheDocument()
  })

  it('shows which weeks each lecturer teaches', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    await table()
    expect(await within(rowOf('Rashad Aliyev')).findByText('Weeks 1, 3, 5, 7, 9, 11')).toBeInTheDocument()
    expect(within(rowOf('Elvin Huseynov')).getByText('Weeks 2, 4, 6, 8, 10, 12')).toBeInTheDocument()
  })

  it('assigns weeks to a lecturer: they leave the old lecturer, who keeps the rest', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await within(await table()).findAllByText('6 modules')
    await user.click(screen.getByRole('button', { name: 'Assign weeks to Nargiz Abbasova' }))
    const form = within(await dialog())
    expect(form.getByRole('checkbox', { name: /^Week 1 · Onboarding & Git/ })).not.toBeChecked()
    expect(form.getAllByText('Now: Rashad Aliyev').length).toBeGreaterThan(0)
    expect(form.getByRole('button', { name: 'Save weeks' })).toBeDisabled()
    await user.click(form.getByRole('checkbox', { name: /^Week 1 · / }))
    await user.click(form.getByRole('checkbox', { name: /^Week 2 · / }))
    expect(form.getByText('Will give 2 weeks.')).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Save weeks' }))

    expect(await screen.findByText('Nargiz Abbasova now teaches weeks 1, 2.')).toBeInTheDocument()
    expect(within(rowOf('Nargiz Abbasova')).getByText('2 modules')).toBeInTheDocument()
    expect(within(rowOf('Rashad Aliyev')).getByText('5 modules')).toBeInTheDocument()
    expect(within(rowOf('Elvin Huseynov')).getByText('5 modules')).toBeInTheDocument()
    expect(listModules().find((m) => m.id === 'm1')!.createdBy).toBe(listUsers().find((u) => u.name === 'Nargiz Abbasova')!.id)
  })

  it('a lecturer’s own weeks start ticked, and unticking one takes the lecturer off that week', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await within(await table()).findAllByText('6 modules')
    await user.click(screen.getByRole('button', { name: 'Assign weeks to Rashad Aliyev' }))
    const form = within(await dialog())
    const own = form.getByRole('checkbox', { name: /^Week 1 · / })
    expect(own).toBeChecked()
    expect(own).toBeEnabled()
    expect(form.getAllByText('Theirs now')).toHaveLength(6)
    await user.click(own)
    await user.click(form.getByRole('checkbox', { name: /^Week 3 · / }))
    expect(form.getByText('Will take off 2 weeks.')).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Save weeks' }))

    expect(await screen.findByText('Rashad Aliyev is off weeks 1, 3.')).toBeInTheDocument()
    expect(within(rowOf('Rashad Aliyev')).getByText('4 modules')).toBeInTheDocument()
    expect(listModules().find((m) => m.id === 'm1')!.createdBy).toBeUndefined()
    // the weeks have no lecturer until someone is given them
    await user.click(screen.getByRole('button', { name: 'Assign weeks to Nargiz Abbasova' }))
    const other = within(await dialog())
    expect(other.getAllByText('No lecturer')).toHaveLength(2)
  })

  it('a week can be taken off one lecturer and given to another in one go', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await within(await table()).findAllByText('6 modules')
    await user.click(screen.getByRole('button', { name: 'Assign weeks to Elvin Huseynov' }))
    const form = within(await dialog())
    await user.click(form.getByRole('checkbox', { name: /^Week 2 · / }))
    await user.click(form.getByRole('checkbox', { name: /^Week 1 · / }))
    await user.click(form.getByRole('button', { name: 'Save weeks' }))
    expect(await screen.findByText('Elvin Huseynov now teaches week 1 and is off week 2.')).toBeInTheDocument()
    expect(listModules().find((m) => m.id === 'm1')!.createdBy).toBe(902)
    expect(listModules().find((m) => m.id === 'm2')!.createdBy).toBeUndefined()
  })

  it('the new lecturer shows on the Modules page for that week', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await within(await table()).findAllByText('6 modules')
    await user.click(screen.getByRole('button', { name: 'Assign weeks to Nargiz Abbasova' }))
    const form = within(await dialog())
    await user.click(form.getByRole('checkbox', { name: /^Week 3 · / }))
    await user.click(form.getByRole('button', { name: 'Save weeks' }))
    await screen.findByText('Nargiz Abbasova now teaches week 3.')
    await user.click(within(screen.getByRole('navigation', { name: 'Admin sections' })).getByRole('link', { name: 'Modules' }))
    const modulesTable = await screen.findByRole('table', { name: 'Modules' })
    const row = (await within(modulesTable).findByRole('link', { name: 'JavaScript' })).closest('tr')!
    expect(await within(row).findByText('Nargiz Abbasova')).toBeInTheDocument()
  })

  it('deletes a lecturer after confirming, saying their modules stay', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    await within(await table()).findAllByText('6 modules')
    await user.click(screen.getByRole('button', { name: 'Delete Elvin Huseynov' }))
    const confirm = within(await dialog())
    expect(await confirm.findByText(/The 6 modules they wrote stay in the course\./)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Delete account' }))
    expect(await screen.findByText('Elvin Huseynov’s account deleted.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Elvin Huseynov' })).not.toBeInTheDocument())
  })

  it('sorts by modules', async () => {
    renderWithProviders(<App />, { route: '/admin/lecturers' })
    const user = userEvent.setup()
    const t = await table()
    await within(t).findAllByText('6 modules')
    await user.click(within(t).getByRole('button', { name: 'Modules' }))
    // fewest first: the lecturer with no modules is first
    expect(within((await rows())[0]).getByText('Nargiz Abbasova')).toBeInTheDocument()
  })
})
