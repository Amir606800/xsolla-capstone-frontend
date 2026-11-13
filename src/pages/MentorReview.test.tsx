import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchReviewedWeeks } from '../api/mentorReviews'
import { fetchMyTeam } from '../api/teams'
import App from '../App'
import { listReviews } from '../mocks/mentorReviews'
import { renderWithProviders } from '../test/renderWithProviders'

vi.setConfig({ testTimeout: 20_000 })

const SAM = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const signIn = (user: object = SAM) => localStorage.setItem('auth_user', JSON.stringify(user))
const demo = (mode: 'locked' | 'reminder') => localStorage.setItem('mentor_review_demo', mode)
const form = () => screen.findByRole('form', { name: /^Review of week \d+$/ })

describe('weekly mentor review: the lock', () => {
  it('a student who owes last week is sent to the form from any page, and told why', async () => {
    signIn()
    demo('locked')
    renderWithProviders(<App />, { route: '/courses' })
    expect(await screen.findByRole('heading', { name: 'Mentor review', level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(/is over and its review is missing\. The LMS is locked until you send it/)
    // the mentor is known: shown, never asked
    expect(within(await form()).getByText('Rashad Aliyev')).toBeInTheDocument()
    expect(screen.queryByText(/Name of your Mentor/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'My courses' })).not.toBeInTheDocument()
  })

  it('sending the review opens the LMS again and stores the answers with the mentor', async () => {
    signIn()
    demo('locked')
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    const f = within(await form())

    // nothing chosen: the form says what is missing and sends nothing
    await user.click(f.getByRole('button', { name: 'Send review' }))
    expect(f.getByText('Choose yes or no.')).toBeInTheDocument()
    expect(listReviews()).toHaveLength(0)

    await user.click(f.getByRole('radio', { name: 'Yes' }))
    await user.click(f.getByRole('checkbox', { name: 'Homework defense and code logic' }))
    for (const statement of [/guidance was clear/, /actively engaged/, /comfortable asking/, /enough time/]) {
      await user.click(within(f.getByRole('group', { name: statement })).getByRole('radio', { name: /^5/ }))
    }
    await user.click(within(f.getByRole('group', { name: /Overall, how satisfied/ })).getByRole('radio', { name: '4' }))
    await user.type(f.getByLabelText(/Any comments or suggestions/), 'More code reviews please')
    await user.click(f.getByRole('button', { name: 'Send review' }))

    expect(await screen.findByText(/Thank you, your review is sent/)).toBeInTheDocument()
    expect(listReviews()[0]).toMatchObject({
      studentId: 1,
      mentorId: 900,
      hadSession: true,
      topics: ['homework'],
      ratings: { clarity: 5, engagement: 5, comfort: 5, time: 5 },
      overall: 4,
      comment: 'More code reviews please',
    })
    await user.click(screen.getByRole('link', { name: 'Go to the dashboard' }))
    expect(await screen.findByRole('heading', { name: /^Welcome/ })).toBeInTheDocument()
  })

  it('"No session" asks for the reason instead of topics and statements', async () => {
    signIn()
    demo('locked')
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    const f = within(await form())
    await user.click(f.getByRole('radio', { name: 'No' }))
    expect(f.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(f.getByRole('radio', { name: 'No session was scheduled' }))
    await user.click(within(f.getByRole('group', { name: /Overall, how satisfied/ })).getByRole('radio', { name: '2' }))
    await user.click(f.getByRole('button', { name: 'Send review' }))
    expect(await screen.findByText(/Thank you, your review is sent/)).toBeInTheDocument()
    expect(listReviews()[0]).toMatchObject({ hadSession: false, noSessionReason: 'not-scheduled', overall: 2 })
    expect(listReviews()[0]).not.toHaveProperty('ratings')
  })
})

describe('weekly mentor review: the weekend reminder', () => {
  it('shows on top of the page with a link to the form, and locks nothing', async () => {
    signIn()
    demo('reminder')
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    const reminder = await screen.findByRole('complementary', { name: 'Weekly mentor review' })
    expect(reminder).toHaveTextContent('Review your week with Rashad Aliyev.')
    expect(screen.getByRole('heading', { name: /^Welcome/ })).toBeInTheDocument()
    await user.click(within(reminder).getByRole('link', { name: 'Review now' }))
    expect(await form()).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('weekly mentor review: who is never asked', () => {
  it('a student with nothing due uses the LMS as usual; the form page says there is nothing to send', async () => {
    signIn()
    renderWithProviders(<App />, { route: '/mentor-review' })
    expect(await screen.findByText(/There is no review to send right now/)).toBeInTheDocument()
  })

  it('a student without a mentor is not locked', async () => {
    signIn()
    demo('locked')
    vi.mocked(fetchMyTeam).mockResolvedValue(null)
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: /^Welcome/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mentor review' })).not.toBeInTheDocument()
    vi.mocked(fetchMyTeam).mockReset()
  })

  it('mentors and lecturers are never locked, and have no review page', async () => {
    vi.mocked(fetchReviewedWeeks).mockClear()
    signIn({ id: 900, name: 'Rashad Aliyev', email: 'r@xsolla.school', roles: ['mentor', 'lecturer'] })
    demo('locked')
    renderWithProviders(<App />, { route: '/mentor-review' })
    expect(await screen.findByRole('heading', { name: /^Welcome/ })).toBeInTheDocument()
    expect(fetchReviewedWeeks).not.toHaveBeenCalled()
  })

  it('a server without mentor reviews locks nobody', async () => {
    signIn()
    demo('locked')
    vi.mocked(fetchReviewedWeeks).mockResolvedValue(null)
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: /^Welcome/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mentor review' })).not.toBeInTheDocument()
  })
})

describe('weekly mentor review: trying it against a real server that has no review routes yet', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('the demo flag still locks, and the review is kept in the browser, never sent to the server', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    vi.mocked(fetchReviewedWeeks).mockClear()
    signIn()
    demo('locked')
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    const f = within(await form())
    await user.click(f.getByRole('radio', { name: 'No' }))
    await user.click(f.getByRole('radio', { name: 'My mentor was not available' }))
    await user.click(within(f.getByRole('group', { name: /Overall, how satisfied/ })).getByRole('radio', { name: '3' }))
    await user.click(f.getByRole('button', { name: 'Send review' }))
    expect(await screen.findByText(/Thank you, your review is sent/)).toBeInTheDocument()
    expect(listReviews()).toHaveLength(1)
    expect(fetchReviewedWeeks).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: 'Go to the dashboard' }))
    expect(await screen.findByRole('heading', { name: /^Welcome/ })).toBeInTheDocument()
  })

  it('without the flag, the real server decides (a server without the routes locks nobody)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    vi.mocked(fetchReviewedWeeks).mockResolvedValue(null)
    signIn()
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: /^Welcome/ })).toBeInTheDocument()
    expect(fetchReviewedWeeks).toHaveBeenCalled()
  })
})
