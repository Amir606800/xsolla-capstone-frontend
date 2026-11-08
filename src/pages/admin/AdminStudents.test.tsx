import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { listTeams, listUsers, passwordMatches, setLeft } from '../../mocks/directory'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const table = () => screen.findByRole('table', { name: 'Students' })
const rows = async () => within(await table()).getAllByRole('row').slice(1)
const dialog = () => screen.findByRole('dialog')

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await table()
  await user.click(screen.getByRole('button', { name: 'Add student' }))
  return within(await dialog())
}

describe('Admin: students', () => {
  it('lists every student with their team and mentor', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    expect(await rows()).toHaveLength(29)
    expect(screen.getByText('29 students')).toBeInTheDocument()
    const sam = screen.getByText('Sam Student').closest('tr')!
    expect(within(sam).getByRole('link', { name: 'student@xsolla.school' })).toHaveAttribute('href', 'mailto:student@xsolla.school')
    expect(within(sam).getByText('Team 3')).toBeInTheDocument()
    expect(within(sam).getByText('Rashad Aliyev')).toBeInTheDocument()
    // staff are not in the list
    expect(screen.queryByText('Elvin Huseynov')).not.toBeInTheDocument()
  })

  it('searches by name or e-mail', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.type(screen.getByRole('searchbox', { name: 'Search students' }), 'hasan')
    expect((await rows()).map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Leyla Hasanova', 'Emil Hasanli'].sort((a, b) => a.localeCompare(b)))
    expect(screen.getByText('2 of 29 students')).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search students' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search students' }), 'nobody-like-this')
    expect(screen.getByText('No students match.')).toBeInTheDocument()
  })

  it('filters by team', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by team' }), 'Team 6')
    const shown = await rows()
    expect(shown).toHaveLength(4)
    for (const r of shown) expect(within(r).getByText('Team 6')).toBeInTheDocument()
  })

  it('adds a student with an e-mail, a password and a team', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const form = await openForm(user)
    await user.type(form.getByLabelText('Full name'), 'Ann Lee')
    await user.type(form.getByLabelText('Email'), 'ann.lee@example.com')
    await user.type(form.getByLabelText('Password'), 'Kp7mWz4qTx')
    await user.selectOptions(form.getByLabelText('Team'), 'Team 6 (4 students)')
    await user.click(form.getByRole('button', { name: 'Add student' }))

    expect(await screen.findByText('Ann Lee added to Team 6. They can sign in with ann.lee@example.com and the password you set.')).toBeInTheDocument()
    expect(await rows()).toHaveLength(30)
    const ann = screen.getByText('Ann Lee').closest('tr')!
    expect(within(ann).getByText('Team 6')).toBeInTheDocument()
    expect(within(ann).getByText('Sevinj Gasimova')).toBeInTheDocument()
    const saved = listUsers().find((u) => u.email === 'ann.lee@example.com')!
    expect(saved.roles).toEqual(['student'])
    expect(listTeams().find((t) => t.id === 't6')!.studentIds).toContain(saved.id)
  })

  it('a student can be added without a team and shows as having none', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const form = await openForm(user)
    await user.type(form.getByLabelText('Full name'), 'Bob Ray')
    await user.type(form.getByLabelText('Email'), 'bob@example.com')
    await user.click(form.getByRole('button', { name: 'Generate' }))
    expect(form.getByLabelText('Password')).toHaveAttribute('type', 'text') // shown, so it can be copied
    expect((form.getByLabelText('Password') as HTMLInputElement).value).toHaveLength(12)
    await user.click(form.getByRole('button', { name: 'Add student' }))
    expect(await screen.findByText(/^Bob Ray added\. /)).toBeInTheDocument()
    expect(within(screen.getByText('Bob Ray').closest('tr')!).getByText('No team')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by team' }), 'No team (1)')
    expect(await rows()).toHaveLength(1)
  })

  it('checks the fields: a real full name, a real and new e-mail, a strong password', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const form = await openForm(user)
    await user.click(form.getByRole('button', { name: 'Add student' }))
    expect(form.getByText('Enter their full name.')).toBeInTheDocument()
    expect(form.getByText('Enter their e-mail address.')).toBeInTheDocument()
    expect(form.getByText('Enter a password.')).toBeInTheDocument()

    await user.type(form.getByLabelText('Full name'), 'asdf')
    expect(form.getByText('Enter their first and last name.')).toBeInTheDocument()
    await user.clear(form.getByLabelText('Full name'))
    await user.type(form.getByLabelText('Full name'), 'Ann Lee')
    expect(form.queryByText(/first and last name/)).not.toBeInTheDocument()

    await user.type(form.getByLabelText('Email'), 'ann@x')
    expect(form.getByText('Enter a real e-mail address, like name@example.com.')).toBeInTheDocument()
    await user.clear(form.getByLabelText('Email'))
    await user.type(form.getByLabelText('Email'), 'ann@mailinator.com')
    expect(form.getByText('Throwaway mailboxes cannot be used: enter their real address.')).toBeInTheDocument()
    await user.clear(form.getByLabelText('Email'))
    await user.type(form.getByLabelText('Email'), 'STUDENT@xsolla.school')
    expect(form.getByText('There is already an account with this email.')).toBeInTheDocument()

    await user.type(form.getByLabelText('Password'), 'password123')
    expect(form.getByText('Add an uppercase letter.')).toBeInTheDocument()
    await user.clear(form.getByLabelText('Password'))
    await user.type(form.getByLabelText('Password'), 'Password123')
    expect(form.getByText('This password is too easy to guess.')).toBeInTheDocument()
    await user.clear(form.getByLabelText('Password'))
    await user.type(form.getByLabelText('Password'), 'AnnLee2026x')
    expect(form.getByText('The password must not contain their name or e-mail.')).toBeInTheDocument()

    // the rules tick off as they are met
    const rules = within(form.getByRole('list', { name: 'Password rules' }))
    expect(rules.getByText('A number').closest('li')).toHaveClass('is-met')
    expect(rules.getByText('Does not contain their name or e-mail').closest('li')).not.toHaveClass('is-met')
    expect(listUsers().filter((u) => u.roles.includes('student'))).toHaveLength(29)
  })

  it('Generate makes a password that passes every rule', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const form = await openForm(user)
    await user.type(form.getByLabelText('Full name'), 'Ann Lee')
    await user.click(form.getByRole('button', { name: 'Generate' }))
    const rules = within(form.getByRole('list', { name: 'Password rules' }))
    for (const item of rules.getAllByRole('listitem')) expect(item).toHaveClass('is-met')
  })

  it('warns when the chosen team is already full', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const form = await openForm(user)
    await user.selectOptions(form.getByLabelText('Team'), 'Team 3 (5 students)')
    expect(form.getByText('Team 3 already has 5 students.')).toBeInTheDocument()
  })

  it('the password can be shown and hidden; Cancel adds nobody', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const form = await openForm(user)
    fireEvent.change(form.getByLabelText('Password'), { target: { value: 'Kp7mWz4qTx' } })
    await user.click(form.getByRole('button', { name: 'Show password' }))
    expect(form.getByLabelText('Password')).toHaveAttribute('type', 'text')
    await user.click(form.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await rows()).toHaveLength(29)
  })

  it('edits a student: corrects the name and e-mail and moves them to another team', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Edit Leyla Hasanova' }))
    const form = within(await dialog())
    expect(form.getByRole('heading', { name: 'Edit Leyla Hasanova' })).toBeInTheDocument()
    expect(form.getByLabelText('Full name')).toHaveValue('Leyla Hasanova')
    expect(form.getByLabelText('Team')).toHaveValue('t3')
    // no password here
    expect(form.queryByLabelText('Password')).not.toBeInTheDocument()
    await user.clear(form.getByLabelText('Full name'))
    await user.type(form.getByLabelText('Full name'), 'Leyla Hasanli')
    await user.clear(form.getByLabelText('Email'))
    await user.type(form.getByLabelText('Email'), 'leyla.h@example.com')
    await user.selectOptions(form.getByLabelText('Team'), 'Team 6 (4 students)')
    await user.click(form.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Leyla Hasanli: changes saved.')).toBeInTheDocument()
    const row = screen.getByText('Leyla Hasanli').closest('tr')!
    expect(within(row).getByText('leyla.h@example.com')).toBeInTheDocument()
    expect(within(row).getByText('Team 6')).toBeInTheDocument()
    expect(screen.queryByText('Leyla Hasanova')).not.toBeInTheDocument()
    expect(listTeams().find((t) => t.id === 't3')!.studentIds).not.toContain(101)
  })

  it('editing keeps the student’s own e-mail allowed, but not someone else’s', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Edit Leyla Hasanova' }))
    const form = within(await dialog())
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Leyla Hasanova: changes saved.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit Leyla Hasanova' }))
    const again = within(await dialog())
    await user.clear(again.getByLabelText('Email'))
    await user.type(again.getByLabelText('Email'), 'student@xsolla.school')
    await user.click(again.getByRole('button', { name: 'Save changes' }))
    expect(again.getByText('There is already an account with this email.')).toBeInTheDocument()
  })

  it('a student who left: out of the list and their team, kept under "Left the school", and can come back', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Murad Guliyev left the school' }))
    const confirm = within(await dialog())
    expect(confirm.getByText(/They can no longer sign in and are taken out of Team 3\. Their account, handed-in work and grades are kept/)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Mark as left' }))
    expect(await screen.findByText('Murad Guliyev is marked as left the school.')).toBeInTheDocument()
    expect(screen.queryByText('Murad Guliyev')).not.toBeInTheDocument()
    expect(await rows()).toHaveLength(28)

    const status = within(screen.getByRole('group', { name: 'Status' }))
    await user.click(status.getByRole('button', { name: /^Left the school/ }))
    const row = screen.getByText('Murad Guliyev').closest('tr')!
    expect(within(row).getByText(/^Left /)).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Edit Murad Guliyev' })).not.toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Bring back Murad Guliyev' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Bring back' }))
    expect(await screen.findByText('Murad Guliyev is back. Put them in a team with Edit.')).toBeInTheDocument()
    expect(within(screen.getByText('Murad Guliyev').closest('tr')!).getByText('No team')).toBeInTheDocument()
  })

  it('the overview does not count students who left', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Murad Guliyev left the school' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Mark as left' }))
    await screen.findByText('Murad Guliyev is marked as left the school.')
    await user.click(within(screen.getByRole('navigation', { name: 'Admin sections' })).getByRole('link', { name: 'Overview' }))
    const tile = within(await screen.findByRole('list', { name: 'School at a glance' })).getByRole('link', { name: /^Students/ })
    expect(tile).toHaveTextContent('28All are in a team')
  })

  it('deletes an account made by mistake, after confirming', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Delete Nigar Ismayilova' }))
    const confirm = within(await dialog())
    expect(confirm.getByText(/If the student left the school, mark them as left instead/)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Nigar Ismayilova')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Nigar Ismayilova' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Delete account' }))
    expect(await screen.findByText('Nigar Ismayilova’s account deleted.')).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'Nigar Ismayilova' })).not.toBeInTheDocument()
    expect(listUsers().some((u) => u.id === 103)).toBe(false)
  })

  it('the overview counts the new student', async () => {
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    const form = await openForm(user)
    await user.type(form.getByLabelText('Full name'), 'Ann Lee')
    await user.type(form.getByLabelText('Email'), 'ann@example.com')
    await user.type(form.getByLabelText('Password'), 'Kp7mWz4qTx')
    await user.click(form.getByRole('button', { name: 'Add student' }))
    await screen.findByText(/^Ann Lee added/)
    await user.click(within(screen.getByRole('navigation', { name: 'Admin sections' })).getByRole('link', { name: 'Overview' }))
    const tile = within(await screen.findByRole('list', { name: 'School at a glance' })).getByRole('link', { name: /^Students/ })
    expect(tile).toHaveTextContent('301 not in a team')
  })

  it('resets a student’s password; a student who left has no reset', async () => {
    setLeft(164, true)
    renderWithProviders(<App />, { route: '/admin/students' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Reset the password of Leyla Hasanova' }))
    const form = within(await dialog())
    await user.type(form.getByLabelText('New password'), 'New-Term-Pass-3')
    await user.click(form.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByText('Leyla Hasanova’s password has been changed.')).toBeInTheDocument()
    expect(passwordMatches(101, 'New-Term-Pass-3')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('Leyla Hasanova has a new password.')).toBeInTheDocument()

    await user.click(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: /^Left the school/ }))
    expect(screen.getByRole('cell', { name: 'Vusala Karimli' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset the password of Vusala Karimli' })).not.toBeInTheDocument()
  })
})
