import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchMyTeam } from '../api/teams'
import { CoursesProvider } from '../context/CoursesProvider'
import { listSlots, reserve } from '../mocks/slots'
import { buildMockTeam } from '../mocks/teams'
import { renderWithProviders } from '../test/renderWithProviders'
import { initials } from '../utils/people'
import TeamPage from './TeamPage'

function renderTeam() {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }))
  return renderWithProviders(
    <CoursesProvider>
      <TeamPage />
    </CoursesProvider>,
  )
}

const members = () => within(screen.getByRole('list', { name: 'Team members' })).getAllByRole('listitem')

describe('TeamPage', () => {
  it('shows a loading state, then the team', async () => {
    renderTeam()
    expect(screen.getByRole('heading', { name: 'My team', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(await screen.findByRole('heading', { name: 'Team 3' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an error with retry, and recovers', async () => {
    vi.mocked(fetchMyTeam).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderTeam()
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load")
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Team 3' })).toBeInTheDocument()
  })

  it('lists 4 or 5 students, and the signed-in student is marked "You"', async () => {
    renderTeam()
    await screen.findByRole('heading', { name: 'Team 3' })
    expect(members().length).toBeGreaterThanOrEqual(4)
    expect(members().length).toBeLessThanOrEqual(5)
    expect(screen.getByText('5 students')).toBeInTheDocument()

    const me = members().find((m) => within(m).queryByText('You'))
    expect(me).toBeDefined()
    expect(me).toHaveTextContent('Sam')
    expect(screen.getAllByText('You')).toHaveLength(1)
  })

  it('shows exactly one mentor, with a way to write to them', async () => {
    renderTeam()
    const card = (await screen.findByRole('heading', { name: 'Your mentor' })).closest('section')!
    const mail = card.querySelectorAll('a[href^="mailto:"]')
    expect(mail).toHaveLength(1)
    expect(mail[0]).toHaveAttribute('href', expect.stringMatching(/^mailto:.+@.+/))
    expect(card).toHaveTextContent('Rashad Aliyev')
    expect(card).toHaveTextContent('Mentor of Team 3')
  })

  it('shows teammates e-mail addresses as mail links', async () => {
    renderTeam()
    await screen.findByRole('heading', { name: 'Team 3' })
    for (const m of members()) expect(within(m).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^mailto:/))
  })

  it('shows the 1:1 the student booked', async () => {
    const free = listSlots({ id: 1, name: 'Sam', role: 'student' }).find((s) => !s.booked)!
    reserve({ id: 1, name: 'Sam', role: 'student' }, free.id)
    renderTeam()
    expect(await screen.findByText(/Next 1:1:/)).toBeInTheDocument()
    expect(screen.queryByText(/No 1:1 booked yet/)).not.toBeInTheDocument()
  })

  it('points to the calendar when nothing is booked and the mentor has free times', async () => {
    renderTeam()
    expect(await screen.findByText(/No 1:1 booked yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pick a time in the calendar' })).toHaveAttribute('href', '/calendar')
    expect(screen.queryByText(/Next 1:1:/)).not.toBeInTheDocument()
  })

  it('explains how the cohort is split', async () => {
    renderTeam()
    expect(await screen.findByText(/29 students in 6 teams of 4-5, each with one mentor/)).toBeInTheDocument()
  })
})

describe('mock team', () => {
  it('has the signed-in user plus teammates, sorted by name, with one mentor', () => {
    const team = buildMockTeam({ id: 7, name: 'Zed Zulu', email: 'z@x.co' })
    expect(team.members.map((m) => m.name)).toEqual([...team.members.map((m) => m.name)].sort((a, b) => a.localeCompare(b)))
    expect(team.members.some((m) => m.id === 7)).toBe(true)
    expect(team.mentor.id).not.toBe(7)
    expect(team.members.some((m) => m.id === team.mentor.id)).toBe(false)
  })

  it('splits a cohort of about 30 into teams of 4-5', () => {
    const { cohortSize, teamCount } = buildMockTeam({ id: 1, name: 'A', email: 'a@x.co' })
    expect(cohortSize).toBeGreaterThanOrEqual(28)
    expect(cohortSize).toBeLessThanOrEqual(30)
    expect(cohortSize / teamCount).toBeGreaterThanOrEqual(4)
    expect(cohortSize / teamCount).toBeLessThanOrEqual(5)
  })
})

describe('initials', () => {
  it('uses the first and last name', () => {
    expect(initials('Leyla Hasanova')).toBe('LH')
    expect(initials('Ana Maria Costa')).toBe('AC')
  })

  it('copes with one name, extra spaces and nothing', () => {
    expect(initials('Madonna')).toBe('M')
    expect(initials('  tural   karimov ')).toBe('TK')
    expect(initials('')).toBe('?')
  })
})
