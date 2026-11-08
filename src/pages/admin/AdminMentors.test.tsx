import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { listTeams, listUsers, setRoles } from '../../mocks/directory'
import { renderWithProviders } from '../../test/renderWithProviders'
import { dayInput } from '../../utils/adminRoles'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const table = () => screen.findByRole('table', { name: 'Mentors' })
const rows = async () => within(await table()).getAllByRole('row').slice(1)
const rowOf = (name: string) => screen.getByRole('cell', { name }).closest('tr')!
const dialog = () => screen.findByRole('dialog')

describe('Admin: mentors', () => {
  it('lists every mentor with their team and roles', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    expect(await rows()).toHaveLength(6)
    const rashad = rowOf('Rashad Aliyev')
    expect(within(rashad).getByText('Team 3 · 5 students')).toBeInTheDocument()
    // the main role first, the extra one after it
    expect(within(rashad).getByText('Mentor')).toHaveAttribute('title', 'Main role')
    expect(within(rashad).getByText('+ Lecturer')).toHaveAttribute('title', 'Extra role')
    expect(within(rowOf('Aysel Mammadova')).queryByText(/Lecturer/)).not.toBeInTheDocument()
    // lecturers who do not mentor are not here
    expect(screen.queryByRole('cell', { name: 'Elvin Huseynov' })).not.toBeInTheDocument()
  })

  it('filters: also lecturers, without a team; and searches', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    const show = within(screen.getByRole('group', { name: 'Show' }))
    await user.click(show.getByRole('button', { name: /^Also lecturers/ }))
    expect((await rows()).map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Rashad Aliyev'])
    await user.click(show.getByRole('button', { name: /^Without a team/ }))
    expect(screen.getByText('No mentors match.')).toBeInTheDocument()
    await user.click(show.getByRole('button', { name: /^All/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search mentors' }), 'farid')
    expect(await rows()).toHaveLength(1)
  })

  it('adds a mentor with a password and a team; the team’s old mentor is told and left without one', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Add mentor' }))
    const form = within(await dialog())
    await user.type(form.getByLabelText('Full name'), 'Nil Aydin')
    await user.type(form.getByLabelText('Email'), 'nil@example.com')
    await user.type(form.getByLabelText('Password'), 'secret123')
    await user.selectOptions(form.getByLabelText('Team they mentor'), 'Team 4 (mentor: Aysel Mammadova)')
    expect(form.getByText('Team 4 is mentored by Aysel Mammadova now. Aysel Mammadova will have no team.')).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Add mentor' }))

    expect(await screen.findByText('Nil Aydin added as a mentor of Team 4. They can sign in with nil@example.com and the password you set.')).toBeInTheDocument()
    expect(within(rowOf('Nil Aydin')).getByText(/^Team 4/)).toBeInTheDocument()
    expect(within(rowOf('Nil Aydin')).getByText('Mentor')).toBeInTheDocument()
    expect(within(rowOf('Aysel Mammadova')).getByText('No team')).toBeInTheDocument()
    expect(listUsers().find((u) => u.email === 'nil@example.com')!.roles).toEqual(['mentor'])
    expect(listTeams().find((t) => t.id === 't4')!.mentorId).toBe(listUsers().find((u) => u.email === 'nil@example.com')!.id)
  })

  it('edits a mentor: name and team', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Edit Farid Mammadli' }))
    const form = within(await dialog())
    expect(form.getByLabelText('Team they mentor')).toHaveValue('t1')
    expect(form.queryByLabelText('Password')).not.toBeInTheDocument()
    await user.clear(form.getByLabelText('Full name'))
    await user.type(form.getByLabelText('Full name'), 'Farid Mammadov')
    await user.selectOptions(form.getByLabelText('Team they mentor'), 'No team yet')
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Farid Mammadov: changes saved.')).toBeInTheDocument()
    expect(within(rowOf('Farid Mammadov')).getByText('No team')).toBeInTheDocument()
    // the team without a mentor is pointed out
    expect(screen.getByRole('note')).toHaveTextContent('Team 1 has no mentor.')
  })

  it('gives the extra lecturer role until a date; the row shows until when', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Roles of Aysel Mammadova' }))
    const form = within(await dialog())
    expect(form.getByRole('group', { name: 'Main role' })).toHaveTextContent('Mentor')
    expect(form.getByRole('radio', { name: 'Not a lecturer' })).toBeChecked()
    await user.click(form.getByRole('radio', { name: /^Lecturer for a while/ }))
    await user.click(form.getByRole('button', { name: '1 month' }))
    expect(form.getByLabelText('Last day')).toHaveValue(dayInput(new Date(), 30))
    await user.click(form.getByRole('button', { name: 'Save roles' }))

    expect(await screen.findByText(/^Aysel Mammadova: Mentor, and lecturer until \w+ \d+\.$/)).toBeInTheDocument()
    const pill = within(rowOf('Aysel Mammadova')).getByText('+ Lecturer').closest('.admin-pill')!
    expect(pill).toHaveTextContent(/until .+ · 30 days left/)
    const aysel = listUsers().find((u) => u.id === 901)!
    expect(aysel.roles).toEqual(['mentor', 'lecturer'])
    expect(aysel.roleUntil?.lecturer).toBeDefined()
  })

  it('the mentor role they were created with cannot be changed; the last day must not be in the past', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Roles of Aysel Mammadova' }))
    const form = within(await dialog())
    expect(form.getByRole('group', { name: 'Main role' })).toHaveTextContent('It cannot be changed or taken away.')
    // nothing to switch the mentor role off with
    expect(form.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(form.queryByRole('radio', { name: /not a mentor/i })).not.toBeInTheDocument()

    await user.click(form.getByRole('radio', { name: /^Lecturer for a while/ }))
    fireEvent.change(form.getByLabelText('Last day'), { target: { value: '2020-01-01' } })
    await user.click(form.getByRole('button', { name: 'Save roles' }))
    expect(form.getByText('Pick a day from today on.')).toBeInTheDocument()
    expect(listUsers().find((u) => u.id === 901)!.roles).toEqual(['mentor'])
  })

  it('takes the extra lecturer role away; the mentor role stays', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Roles of Rashad Aliyev' }))
    const form = within(await dialog())
    expect(form.getByRole('radio', { name: 'Lecturer, no end date' })).toBeChecked()
    await user.click(form.getByRole('radio', { name: 'Not a lecturer' }))
    await user.click(form.getByRole('button', { name: 'Save roles' }))
    expect(await screen.findByText('Rashad Aliyev: Mentor only.')).toBeInTheDocument()
    expect(within(rowOf('Rashad Aliyev')).queryByText(/Lecturer/)).not.toBeInTheDocument()
    expect(listTeams().find((t) => t.id === 't3')!.mentorId).toBe(900)
  })

  it('a lecturer who was given the mentor role is listed, with Lecturer as their main role', async () => {
    setRoles(902, ['lecturer', 'mentor'])
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    const elvin = rowOf('Elvin Huseynov')
    expect(within(elvin).getByText('Lecturer')).toHaveAttribute('title', 'Main role')
    expect(within(elvin).getByText('+ Mentor')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Roles of Elvin Huseynov' }))
    const form = within(await dialog())
    expect(form.getByRole('group', { name: 'Main role' })).toHaveTextContent('Lecturer')
    expect(form.getByRole('radio', { name: 'Mentor, no end date' })).toBeChecked()
    // taking the extra mentor role back sends them back to the Lecturers page
    await user.click(form.getByRole('radio', { name: 'Not a mentor' }))
    await user.click(form.getByRole('button', { name: 'Save roles' }))
    expect(await screen.findByText('Elvin Huseynov is no longer a mentor. You will find them under Lecturers.')).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'Elvin Huseynov' })).not.toBeInTheDocument()
  })

  it('deletes a mentor’s account; their team is left without a mentor', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Delete Javid Huseynli' }))
    const confirm = within(await dialog())
    expect(confirm.getByText(/Team 5 will have no mentor until you give it one\./)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Delete account' }))
    expect(await screen.findByText('Javid Huseynli’s account deleted.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Javid Huseynli' })).not.toBeInTheDocument())
    expect(screen.getByRole('note')).toHaveTextContent('Team 5 has no mentor.')
  })
})

describe('Admin: resetting a password', () => {
  it('sets a new password, shows it once to copy, and only the new one signs them in', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Reset the password of Aysel Mammadova' }))
    let form = within(await dialog())
    expect(form.getByText(/Their old password stops working/)).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Set new password' }))
    expect(form.getByText('At least 8 characters.', { selector: '.admin-field__error' })).toBeInTheDocument()

    await user.type(form.getByLabelText('New password'), 'fresh-start-1')
    await user.click(form.getByRole('button', { name: 'Set new password' }))
    form = within(await screen.findByRole('group', { name: 'New password for Aysel Mammadova' }))
    expect(form.getByText('Aysel Mammadova’s password has been changed.')).toBeInTheDocument()
    expect(form.getByLabelText('New password')).toHaveTextContent('fresh-start-1')
    await user.click(form.getByRole('button', { name: 'Copy' }))
    // user-event gives the page a clipboard: what was copied can be read back
    expect(await navigator.clipboard.readText()).toBe('fresh-start-1')
    expect(form.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('Aysel Mammadova has a new password.')).toBeInTheDocument()

    // offline sign-in: the old password no longer works, the new one does
    const { login } = await vi.importActual<typeof import('../../api/auth.mock')>('../../api/auth.mock')
    await expect(login('mentor@xsolla.school', 'demo')).rejects.toThrow('Invalid email or password')
    await expect(login('mentor@xsolla.school', 'fresh-start-1')).resolves.toMatchObject({ id: 901 })
  })

  it('Generate fills in a strong password and shows it; Cancel changes nothing', async () => {
    renderWithProviders(<App />, { route: '/admin/mentors' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Reset the password of Aysel Mammadova' }))
    const form = within(await dialog())
    await user.click(form.getByRole('button', { name: 'Generate' }))
    const input = form.getByLabelText('New password') as HTMLInputElement
    expect(input.value).toHaveLength(12)
    expect(input).toHaveAttribute('type', 'text')
    await user.click(form.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(localStorage.getItem('school_directory') ?? '').not.toContain('passwords')
  })
})

describe('A lecturer role that has ended', () => {
  it('takes the lecturer pages away from the mentor in the LMS', async () => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 901, name: 'Aysel', email: 'mentor@xsolla.school', roles: ['mentor', 'lecturer'], roleUntil: { lecturer: '2020-01-01T00:00:00.000Z' } }),
    )
    renderWithProviders(<App />, { route: '/dashboard' })
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByRole('link', { name: 'My team' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Course content' })).not.toBeInTheDocument()
  })

  it('while it lasts, the mentor has the lecturer pages', async () => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 901, name: 'Aysel', email: 'mentor@xsolla.school', roles: ['mentor', 'lecturer'], roleUntil: { lecturer: '2999-01-01T00:00:00.000Z' } }),
    )
    renderWithProviders(<App />, { route: '/dashboard' })
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByRole('link', { name: 'Course content' })).toBeInTheDocument()
  })
})
