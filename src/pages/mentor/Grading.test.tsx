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

const cards = (week: number) => screen.findByRole('list', { name: `Week ${week} students` })
/** Opens one student's page from the week's cards. */
async function openStudent(user: ReturnType<typeof userEvent.setup>, name: string, week = 5) {
  await user.click(within(await cards(week)).getByRole('button', { name: `Open ${name}'s week ${week}` }))
}

describe('Grading page: a card per student, then one student at a time', () => {
  it('opens on the oldest finished week that still needs grades, with a card for each student', async () => {
    renderAs(['mentor'], '/grading')
    expect(await screen.findByRole('heading', { name: 'Week 5 · React' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 5, 4 to grade' })).toHaveAttribute('aria-pressed', 'true')
    const list = within(await cards(5))
    expect(list.getAllByRole('listitem')).toHaveLength(5)
    // Sam already has his week-5 grade, the four others do not
    expect(list.getAllByText('Not graded')).toHaveLength(4)
    expect(list.getAllByText('Week grade due')).toHaveLength(4)
    expect(screen.getByText(/graded ·/).closest('p')).toHaveTextContent('1 of 5 graded')
    // every week of the course as dots, and how much work is in
    expect(list.getAllByRole('img', { name: /Week 1: / })).toHaveLength(5)
    expect(list.getAllByText(/handed in$/).length).toBe(5)
  })

  it('a card opens the student: their grade, tasks and quizzes; the arrows go to the next student and back', async () => {
    const user = userEvent.setup()
    renderAs(['mentor'], '/grading?week=m5')
    await openStudent(user, 'Leyla Hasanova')
    expect(await screen.findByRole('heading', { name: 'Leyla Hasanova', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: "Leyla Hasanova's tasks" })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Week 5 grade for Leyla Hasanova' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quizzes' })).toBeInTheDocument()
    // only Leyla's work: nobody else's name on a task
    expect(within(screen.getByRole('list', { name: "Leyla Hasanova's tasks" })).queryByText(/Murad/)).toBeNull()

    const nextBtn = screen.getByRole('button', { name: /^Next student: / })
    const nextName = nextBtn.getAttribute('aria-label')!.replace('Next student: ', '')
    await user.click(nextBtn)
    expect(await screen.findByRole('heading', { name: nextName, level: 2 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous student: Leyla Hasanova' }))
    expect(await screen.findByRole('heading', { name: 'Leyla Hasanova', level: 2 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'All students' }))
    expect(await cards(5)).toBeInTheDocument()
  })

  it('grades a week with a level and a note; the student sees it', async () => {
    const user = userEvent.setup()
    renderAs(['mentor'], '/grading?week=m5')
    await openStudent(user, 'Leyla Hasanova')

    await user.click(await screen.findByRole('button', { name: 'Save week grade' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick green, yellow or red')

    await user.click(screen.getByRole('radio', { name: /Falling behind/ }))
    await user.type(screen.getByLabelText('Note for Leyla Hasanova (optional)'), 'Routing app was late.')
    await user.click(screen.getByRole('button', { name: 'Save week grade' }))

    expect(await screen.findByText('Leyla Hasanova: week 5 graded falling behind.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 5, 3 to grade' })).toBeInTheDocument()
    expect(standingsOf(101).find((s) => s.week === 5)).toMatchObject({ level: 'yellow', note: 'Routing app was late.' })
    // the dot of week 5 on her page now says so
    expect(screen.getByRole('button', { name: 'Week 5: falling behind' })).toBeInTheDocument()
  })

  it('the dashboard link (?grade=) opens that student, and warns when a grade sets off a program rule', async () => {
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
    await openStudent(user, 'Leyla Hasanova')
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
    renderAs(['mentor'], '/grading?week=m5&open=m5-a1~101')
    expect(await screen.findByText('Second version with tests')).toBeInTheDocument()
    await user.click(screen.getByText('Earlier versions (1)'))
    const earlier = within(screen.getByRole('list', { name: 'Earlier versions' }))
    expect(earlier.getByText(/^Version 1 · /)).toBeInTheDocument()
    expect(earlier.getByText(/github.com\/xsolla-school\/team-3\/components/)).toBeInTheDocument()
  })

  it('a week that has not started has nothing to grade', async () => {
    renderAs(['mentor'], '/grading?week=m8')
    expect(await screen.findByText(/This week has not started yet/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Week 8 students' })).not.toBeInTheDocument()
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

  it('on the real server: no note field (it keeps only the colour), the team hand-ins are shown, quiz results are not', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    const user = userEvent.setup()
    renderAs(['mentor'], '/grading?week=m5')
    await openStudent(user, 'Leyla Hasanova')
    expect(await screen.findByRole('group', { name: 'Week 5 grade for Leyla Hasanova' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Note for/)).not.toBeInTheDocument()
    expect(screen.queryByText(/does not show your students/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/handed in/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Tasks are not graded/)).toBeInTheDocument()
    expect(screen.queryByText(/Not taken/)).toBeNull()
  })
})
