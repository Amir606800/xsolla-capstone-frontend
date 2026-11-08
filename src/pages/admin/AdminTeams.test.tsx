import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { listTeams } from '../../mocks/directory'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const team = async (name: string) => within(await screen.findByRole('region', { name }))
const dialog = () => screen.findByRole('dialog')

async function removeAllTeams(user: ReturnType<typeof userEvent.setup>) {
  await team('Team 1')
  await user.click(screen.getByRole('button', { name: 'Remove all teams…' }))
  await user.click(within(await dialog()).getByRole('button', { name: 'Remove all teams' }))
  await screen.findByRole('heading', { name: 'There are no teams yet' })
}

describe('Admin: teams', () => {
  it('shows every team with its mentor and students', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const t3 = await team('Team 3')
    expect(t3.getByRole('combobox', { name: 'Mentor of Team 3' })).toHaveDisplayValue('Rashad Aliyev')
    expect(t3.getByText('5 students')).toBeInTheDocument()
    expect(t3.getByText('Sam Student')).toBeInTheDocument()
    expect(screen.getByText('6 teams · 29 students')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Students without a team' })).not.toBeInTheDocument()
  })

  it('moves a student to another team (the team may go over 5, and says so)', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    const t3 = await team('Team 3')
    await user.selectOptions(t3.getByRole('combobox', { name: 'Move Sam Student to another team' }), 'Team 1')
    expect(await screen.findByText('Sam Student moved from Team 3 to Team 1. Team 1 now has 6 students.')).toBeInTheDocument()
    expect((await team('Team 1')).getByText('Sam Student')).toBeInTheDocument()
    expect((await team('Team 3')).queryByText('Sam Student')).not.toBeInTheDocument()
    expect(listTeams().find((t) => t.id === 't1')!.studentIds).toContain(1)
  })

  it('takes a student out of their team; they wait under "Without a team" and can be put back or into another', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    const t4 = await team('Team 4')
    await user.selectOptions(t4.getByRole('combobox', { name: 'Move Kamran Rzayev to another team' }), 'Take out of Team 4')
    expect(await screen.findByText('Kamran Rzayev is out of Team 4.')).toBeInTheDocument()
    const loose = within(await screen.findByRole('region', { name: 'Students without a team' }))
    expect(loose.getByText('Kamran Rzayev')).toBeInTheDocument()
    expect(screen.getByText('6 teams · 29 students · 1 without a team')).toBeInTheDocument()

    await user.selectOptions(loose.getByRole('combobox', { name: 'Put Kamran Rzayev in a team' }), 'Team 6')
    expect(await screen.findByText('Kamran Rzayev moved to Team 6.')).toBeInTheDocument()
    expect((await team('Team 6')).getByText('Kamran Rzayev')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Students without a team' })).not.toBeInTheDocument()
  })

  it('adds a student without a team from a team’s own list', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    const t4 = await team('Team 4')
    await user.selectOptions(t4.getByRole('combobox', { name: 'Move Kamran Rzayev to another team' }), 'Take out of Team 4')
    await screen.findByRole('region', { name: 'Students without a team' })
    const t6 = await team('Team 6')
    await user.selectOptions(t6.getByRole('combobox', { name: 'Add a student to Team 6' }), 'Kamran Rzayev')
    expect(await screen.findByText('Kamran Rzayev moved to Team 6.')).toBeInTheDocument()
    expect((await team('Team 6')).getByText('Kamran Rzayev')).toBeInTheDocument()
  })

  it('changes a team’s mentor; a mentor who led another team leaves it without one', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    const t1 = await team('Team 1')
    await user.selectOptions(t1.getByRole('combobox', { name: 'Mentor of Team 1' }), 'Aysel Mammadova (now Team 4)')
    expect(await screen.findByText('Aysel Mammadova now mentors Team 1. Team 4 has no mentor now.')).toBeInTheDocument()
    expect((await team('Team 4')).getByRole('combobox', { name: 'Mentor of Team 4' })).toHaveDisplayValue('No mentor')

    await user.selectOptions((await team('Team 1')).getByRole('combobox', { name: 'Mentor of Team 1' }), 'No mentor')
    expect(await screen.findByText('Team 1 has no mentor now.')).toBeInTheDocument()
  })

  it('with no teams, only making them is offered', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await removeAllTeams(user)
    expect(screen.getByText('All teams removed.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /^Team \d/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create random teams…' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove all teams…' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create these teams' })).toBeEnabled()
    expect(screen.getByText(/^29 students → 6 teams of 5 or 4\./)).toBeInTheDocument()
  })

  it('creates random teams from a preview: everyone placed, a mentor each, nothing before the click', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await removeAllTeams(user)
    expect(listTeams()).toEqual([])
    const preview = within(screen.getByRole('list', { name: 'Preview' }))
    expect(preview.getAllByRole('listitem')).toHaveLength(6)
    expect(preview.getAllByText(/^Mentor: /)).toHaveLength(6)

    await user.click(screen.getByRole('button', { name: 'Create these teams' }))
    expect(await screen.findByText('6 teams created.')).toBeInTheDocument()
    expect(screen.getByText('6 teams · 29 students')).toBeInTheDocument()
    const teams = listTeams()
    expect(teams).toHaveLength(6)
    expect(teams.flatMap((t) => t.studentIds)).toHaveLength(29)
    expect(new Set(teams.map((t) => t.mentorId)).size).toBe(6)
    // and now the usual page
    expect(screen.getByRole('button', { name: 'Create random teams…' })).toBeInTheDocument()
  })

  it('a smaller team size makes more teams, and teams without a mentor are told', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await removeAllTeams(user)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Most students in a team' }), 'Up to 4')
    expect(screen.getAllByRole('listitem').filter((li) => li.className.includes('admin-maker__team'))).toHaveLength(8)
    expect(screen.getByText(/6 mentors for 8 teams: 2 teams have no mentor\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shuffle again' }))
    expect(screen.getByRole('list', { name: 'Preview' }).children).toHaveLength(8)
  })

  it('making teams again needs a tick, because it replaces every team', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await team('Team 1')
    await user.click(screen.getByRole('button', { name: 'Create random teams…' }))
    const modal = within(await dialog())
    const create = modal.getByRole('button', { name: 'Replace teams' })
    expect(create).toBeDisabled()
    expect(modal.getByText(/This replaces all 6 teams\./)).toBeInTheDocument()
    await user.click(modal.getByRole('checkbox'))
    expect(create).toBeEnabled()
    await user.click(create)
    expect(await screen.findByText('6 teams created.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(listTeams()).toHaveLength(6)
    // the old arrangement is gone: Sam is somewhere else, or at least the teams were rebuilt
    expect(listTeams().flatMap((t) => t.studentIds)).toHaveLength(29)
  })

  it('removing all teams asks first, and Cancel keeps them', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await team('Team 1')
    await user.click(screen.getByRole('button', { name: 'Remove all teams…' }))
    const confirm = within(await dialog())
    expect(confirm.getByText(/All 6 teams are deleted\./)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Cancel' }))
    expect(listTeams()).toHaveLength(6)
  })

  it('the overview shows the new teams', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await removeAllTeams(user)
    await user.click(within(screen.getByRole('navigation', { name: 'Admin sections' })).getByRole('link', { name: 'Overview' }))
    const tile = within(await screen.findByRole('list', { name: 'School at a glance' })).getByRole('link', { name: /^Teams/ })
    expect(tile).toHaveTextContent('0No teams yet')
  })
})

// many clicks on a page of six teams with a select per student: slow when the whole suite runs at once
describe('Admin: one team at a time', { timeout: 15_000 }, () => {
  it('adds a team: the next name, a free mentor and students without a team', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    // free a mentor and two students first
    await team('Team 6')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mentor of Team 6' }), 'No mentor')
    await screen.findByText('Team 6 has no mentor now.')
    for (const name of ['Anar Novruzov', 'Gulnar Mammadova']) {
      await user.selectOptions(screen.getByRole('combobox', { name: `Move ${name} to another team` }), 'Take out of Team 6')
      await screen.findByText(`${name} is out of Team 6.`)
    }

    await user.click(screen.getByRole('button', { name: 'Add team' }))
    const form = within(await dialog())
    expect(form.getByLabelText('Name')).toHaveValue('Team 7')
    expect(form.getByLabelText('Mentor')).toHaveDisplayValue('Sevinj Gasimova') // the one without a team
    await user.click(form.getByRole('checkbox', { name: 'Anar Novruzov' }))
    await user.click(form.getByRole('checkbox', { name: 'Gulnar Mammadova' }))
    expect(form.getByText('2 students.')).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Add team' }))

    expect(await screen.findByText('Team 7 added: mentor Sevinj Gasimova, 2 students.')).toBeInTheDocument()
    const t7 = await team('Team 7')
    expect(t7.getByRole('combobox', { name: 'Mentor of Team 7' })).toHaveDisplayValue('Sevinj Gasimova')
    expect(t7.getByText('Anar Novruzov')).toBeInTheDocument()
    expect(screen.getByText('7 teams · 29 students')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Students without a team' })).not.toBeInTheDocument()
  })

  it('the name must be new; a mentor taken from another team is told', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await team('Team 1')
    await user.click(screen.getByRole('button', { name: 'Add team' }))
    const form = within(await dialog())
    await user.clear(form.getByLabelText('Name'))
    await user.type(form.getByLabelText('Name'), 'team 2')
    await user.click(form.getByRole('button', { name: 'Add team' }))
    expect(form.getByText('There is already a team called team 2.')).toBeInTheDocument()

    await user.clear(form.getByLabelText('Name'))
    await user.type(form.getByLabelText('Name'), 'Rockets')
    await user.selectOptions(form.getByLabelText('Mentor'), 'Aysel Mammadova (now Team 4)')
    expect(form.getByText('They leave Team 4, which will have no mentor.')).toBeInTheDocument()
    expect(form.getByText(/Every student is in a team/)).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Add team' }))
    expect(await screen.findByText('Rockets added: mentor Aysel Mammadova, no students yet. Team 4 has no mentor now.')).toBeInTheDocument()
    expect((await team('Team 4')).getByRole('combobox', { name: 'Mentor of Team 4' })).toHaveDisplayValue('No mentor')
    expect((await team('Rockets')).getByText('No students yet.')).toBeInTheDocument()
  })

  it('deletes one team after asking: its students wait under "Without a team"', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await team('Team 3')
    await user.click(screen.getByRole('button', { name: 'Delete Team 3' }))
    const confirm = within(await dialog())
    expect(confirm.getByText(/Its 5 students will be without a team until you put them in another one\. Rashad Aliyev will have no team to mentor\./)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Delete team' }))

    expect(await screen.findByText('Team 3 deleted. 5 students are without a team now.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Team 3' })).not.toBeInTheDocument())
    const loose = await team('Students without a team')
    expect(loose.getByText('Sam Student')).toBeInTheDocument()
    expect(screen.getByText('5 teams · 29 students · 5 without a team')).toBeInTheDocument()
    expect(listTeams().map((t) => t.name)).toEqual(['Team 1', 'Team 2', 'Team 4', 'Team 5', 'Team 6'])
  })

  it('Cancel keeps the team', async () => {
    renderWithProviders(<App />, { route: '/admin/teams' })
    const user = userEvent.setup()
    await team('Team 2')
    await user.click(screen.getByRole('button', { name: 'Delete Team 2' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Cancel' }))
    expect(listTeams()).toHaveLength(6)
  })
})
