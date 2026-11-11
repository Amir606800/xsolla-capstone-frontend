import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { standingsOf } from '../../mocks/standings'
import { handIn, submissionsOf } from '../../mocks/submissions'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { Role } from '../../types/user'

// Wed 4 Nov 2026: module 6 runs this week, week 5 is finished
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
})
afterEach(() => vi.useRealTimers())

function renderAs(roles: Role[], route: string, id = 900, name = 'Rashad Aliyev') {
  localStorage.setItem('auth_user', JSON.stringify({ id, name, email: 'x@xsolla.school', roles }))
  return renderWithProviders(<App />, { route })
}

const gradesList = (week: number) => screen.findByRole('list', { name: `Week ${week} grades` })

describe('Grading page: one grade per student per week', () => {
  it('opens on the oldest finished week that still needs grades', async () => {
    renderAs(['mentor'], '/grading')
    expect(await screen.findByRole('heading', { name: 'Week 5 · React' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 5, 4 to grade' })).toHaveAttribute('aria-pressed', 'true')
    const rows = within(await gradesList(5)).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    // Sam already has his week-5 grade, the four others do not
    expect(within(await gradesList(5)).getAllByText('Not graded')).toHaveLength(4)
    expect(screen.getByText('1 of 5 graded')).toBeInTheDocument()
  })

  it('grades a week with a level and a note; the student sees it', async () => {
    const user = userEvent.setup()
    renderAs(['mentor'], '/grading?week=m5')
    await user.click(await screen.findByRole('button', { name: "Grade Leyla Hasanova's week 5" }))

    await user.click(screen.getByRole('button', { name: 'Save week grade' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick green, yellow or red')

    await user.click(screen.getByRole('radio', { name: /Falling behind/ }))
    await user.type(screen.getByLabelText('Note for Leyla Hasanova (optional)'), 'Routing app was late.')
    await user.click(screen.getByRole('button', { name: 'Save week grade' }))

    expect(await screen.findByText('Leyla Hasanova: week 5 graded falling behind.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 5, 3 to grade' })).toBeInTheDocument()
    expect(standingsOf(101).find((s) => s.week === 5)).toMatchObject({ level: 'yellow', note: 'Routing app was late.' })
  })

  it('warns when a grade sets off a program rule', async () => {
    const user = userEvent.setup()
    // Murad (102) was yellow in weeks 2-4
    renderAs(['mentor'], '/grading?week=m5&grade=102')
    await user.click(await screen.findByRole('radio', { name: /Falling behind/ }))
    expect(screen.getByText(/4th yellow week in a row, so it counts as red/)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /On track/ }))
    expect(screen.queryByText(/counts as red/)).not.toBeInTheDocument()
  })

  it('the tasks are not graded: the mentor reads the work and comments', async () => {
    const user = userEvent.setup()
    renderAs(['mentor'], '/grading?week=m5')
    expect(await screen.findByText(/Tasks are not graded/)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: "Open Leyla Hasanova's Components" }))
    expect(screen.getByText(/github.com\/xsolla-school\/team-3\/components/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark graded/i })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Comment for Leyla Hasanova'), 'Nice structure.')
    await user.click(screen.getByRole('button', { name: 'Add comment' }))
    expect(await screen.findByText("Comment saved on Leyla Hasanova's Components.")).toBeInTheDocument()
    expect(submissionsOf(101)['m5-a1']).toMatchObject({ feedback: 'Nice structure.' })
    expect(submissionsOf(101)['m5-a1']?.gradedAt).toBeUndefined()

    // and it can be changed
    await user.click(screen.getByRole('button', { name: /Edit comment/ }))
    const box = screen.getByLabelText('Comment for Leyla Hasanova')
    await user.clear(box)
    await user.type(box, 'Nice structure, add tests.')
    await user.click(screen.getByRole('button', { name: 'Save comment' }))
    expect(await screen.findByText('Nice structure, add tests.')).toBeInTheDocument()
  })

  it('the mentor sees every version a student handed in, the newest on top', async () => {
    // Leyla hands in a second version of Components
    handIn(101, 'm5-a1', { submittedAt: new Date(2026, 9, 30, 9).toISOString(), textBody: 'Second version with tests' })
    const user = userEvent.setup()
    renderAs(['mentor'], '/grading?week=m5')
    await user.click(await screen.findByRole('button', { name: "Open Leyla Hasanova's Components" }))
    expect(screen.getByText('Second version with tests')).toBeInTheDocument()
    await user.click(screen.getByText('Earlier versions (1)'))
    const earlier = within(screen.getByRole('list', { name: 'Earlier versions' }))
    expect(earlier.getByText(/^Version 1 · /)).toBeInTheDocument()
    expect(earlier.getByText(/github.com\/xsolla-school\/team-3\/components/)).toBeInTheDocument()
  })

  it('a week that has not started has nothing to grade', async () => {
    renderAs(['mentor'], '/grading?week=m8')
    expect(await screen.findByText(/This week has not started yet/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Week 8 grades' })).not.toBeInTheDocument()
  })

  it('is only for mentors', async () => {
    renderAs(['lecturer'], '/grading', 902, 'Elvin Huseynov')
    expect(await screen.findByRole('navigation', { name: 'Quick actions' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Grading', level: 1 })).not.toBeInTheDocument()
  })
})

describe('dashboard', () => {
  it('shows the week grades still to give and links straight to one', async () => {
    renderAs(['mentor', 'lecturer'], '/dashboard')
    const tile = (await screen.findByRole('heading', { name: 'Week grades' })).closest('section')!
    expect(tile).toHaveTextContent('4 to give')
    expect(tile).toHaveTextContent('Week 5: 4 students')
    const list = await screen.findByRole('list', { name: 'Week grades to give' })
    expect(within(list).getAllByRole('link')[0].getAttribute('href')).toMatch(/^\/grading\?week=m5&grade=\d+$/)
    expect((await screen.findByRole('heading', { name: 'New work' })).closest('section')).toHaveTextContent('Without a comment yet')
  })

  it('a lecturer who is no mentor has no grading', async () => {
    renderAs(['lecturer'], '/dashboard', 902, 'Elvin Huseynov')
    await screen.findByRole('navigation', { name: 'Quick actions' })
    expect(screen.queryByRole('heading', { name: 'Week grades' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Grading' })).not.toBeInTheDocument()
  })
})

describe('Grading page: what is not there', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('with no weeks it says so instead of showing an empty page', async () => {
    const { fetchModules } = await import('../../api/courses')
    vi.mocked(fetchModules).mockResolvedValue([])
    renderAs(['mentor'], '/grading')
    expect(await screen.findByText(/There are no weeks to grade yet\./)).toBeInTheDocument()
    vi.mocked(fetchModules).mockReset()
  })

  it('a mentor without a team is told there is no one to grade', async () => {
    const { fetchMentorTeam } = await import('../../api/teams')
    vi.mocked(fetchMentorTeam).mockResolvedValueOnce(null)
    renderAs(['mentor'], '/grading')
    expect(await screen.findByText(/You do not look after a team yet/)).toBeInTheDocument()
  })

  it('on the real server: no note field (it keeps only the colour), and the team hand-ins are shown', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const user = userEvent.setup()
    renderAs(['mentor'], '/grading?week=m5')
    await user.click(await screen.findByRole('button', { name: "Grade Leyla Hasanova's week 5" }))
    expect(screen.queryByLabelText(/^Note for/)).not.toBeInTheDocument()
    expect(screen.queryByText(/does not show your students/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/tasks handed in/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Tasks are not graded/)).toBeInTheDocument()
  })
})
