import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { putEvent } from '../../mocks/contentEdits'
import { addFeedback, listFeedback, pendingLectures } from '../../mocks/lectureFeedback'
import { renderWithProviders } from '../../test/renderWithProviders'

// Wed 4 Nov 2026, 12:00: Monday's lecture (2 Nov, 10:00-12:00) is over and its form is open until 9 Nov.
// In the demo that Monday belongs to module 5: module 6 only opens on the Wednesday.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
})
afterEach(() => vi.useRealTimers())

const signIn = (user: object) => localStorage.setItem('auth_user', JSON.stringify(user))
const student = { id: 1, name: 'Sam', email: 'sam@example.com', roles: ['student'] }

async function block() {
  return within(await screen.findByRole('region', { name: 'Lecture feedback' }))
}

describe('Lecture feedback on the module page', () => {
  it('shows the open lecture at the top of the right-hand column: Rating, then Resources, then Quizzes', async () => {
    signIn(student)
    renderWithProviders(<App />, { route: '/courses/m5' })
    const lectures = await block()
    expect(lectures.getByRole('heading', { name: 'Rate your lecture' })).toBeInTheDocument()
    expect(lectures.getByText(/Lecture/)).toBeInTheDocument()
    expect(lectures.getByText(/open until Nov 9/)).toBeInTheDocument()
    // it is not inside the Assignments card any more
    const assignments = screen.getByRole('region', { name: 'Assignments' })
    expect(within(assignments).queryByRole('region', { name: 'Lecture feedback' })).toBeNull()
    // it opens the right-hand column, before Resources, and Resources come before Quizzes
    const rating = screen.getByRole('region', { name: 'Lecture feedback' })
    const resources = screen.getByRole('heading', { name: 'Resources' })
    const quizzes = screen.getByRole('heading', { name: 'Quizzes' })
    expect(rating.parentElement).toBe(resources.closest('.module__side'))
    expect(rating.compareDocumentPosition(resources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(resources.compareDocumentPosition(quizzes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the button opens the form drawn from the server’s questions; sending it thanks the student and stores one answer', async () => {
    signIn(student)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/courses/m5' })
    await user.click(await screen.findByRole('button', { name: /Rate the lecture/ }))

    const form = within(await screen.findByRole('form', { name: /Feedback on Lecture/ }))
    for (const q of [
      'How would you rate this lecture overall?',
      'How clear were the explanations?',
      'How useful were the examples, live coding and exercises?',
      'How was the pace of the lecture?',
      'How confident do you feel about this topic now, including your ability to complete the home task?',
    ]) {
      expect(form.getByText(q)).toBeInTheDocument()
    }
    expect(form.getByText(/What worked well/)).toBeInTheDocument()

    // nothing chosen yet: the form says what is missing and sends nothing
    await user.click(form.getByRole('button', { name: 'Send feedback' }))
    expect(form.getByText('Some answers are missing.')).toBeInTheDocument()
    expect(listFeedback()).toHaveLength(0)

    const rate = (legend: RegExp, label: RegExp) =>
      user.click(within(form.getByRole('group', { name: legend })).getByRole('radio', { name: label }))
    await rate(/rate this lecture overall/, /^4$/)
    await rate(/clear were the explanations/, /^5 - Very clear/)
    await rate(/examples, live coding/, /^3$/)
    await user.click(form.getByRole('radio', { name: 'Too fast' }))
    await rate(/How confident/, /^2$/)
    await user.type(form.getByLabelText(/What worked well/), 'The live coding')
    await user.click(form.getByRole('button', { name: 'Send feedback' }))

    expect(await screen.findByText(/your feedback on/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: /Feedback on Lecture/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Rate the lecture/ })).toBeNull()
    expect(listFeedback()).toHaveLength(1)
    expect(listFeedback()[0].answers).toEqual({
      overall: 4,
      clarity: 5,
      practice: 3,
      pace: 'too_fast',
      confidence: 2,
      liked: 'The live coding',
    })
  })

  it('Cancel closes the form without sending anything', async () => {
    signIn(student)
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/courses/m5' })
    await user.click(await screen.findByRole('button', { name: /Rate the lecture/ }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: /Feedback on Lecture/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Rate the lecture/ })).toBeInTheDocument()
    expect(listFeedback()).toHaveLength(0)
  })

  it('a lecture that was already rated is not asked about again', async () => {
    signIn(student)
    localStorage.setItem(
      'lecture_feedback',
      JSON.stringify([
        { studentId: 1, eventId: 'lec-0', startsAt: new Date(2026, 10, 2, 10).toISOString(), answers: {}, submittedAt: 's' },
      ]),
    )
    renderWithProviders(<App />, { route: '/courses/m5' })
    await screen.findByRole('region', { name: 'Assignments' })
    expect(screen.queryByRole('region', { name: 'Lecture feedback' })).toBeNull()
  })

  it('only the lecture whose form is still open is offered: Monday 2 Nov closed on 9 Nov, 12:00', () => {
    // the demo calendar's ids are relative to today: lec-0 is the Monday of the current week
    // Wed 11 Nov: the lecture of the 9th is over and open; the one of the 2nd closed at 12:00 on the 9th
    expect(pendingLectures(1, new Date(2026, 10, 11, 12, 0)).map((l) => l.startsAt.slice(0, 10))).toEqual(['2026-11-09'])
    // Mon 9 Nov, 11:49: the lecture is still running, so only last week's is open; at 11:50 (10 minutes before the end) both
    expect(pendingLectures(1, new Date(2026, 10, 9, 11, 49)).map((l) => l.startsAt.slice(0, 10))).toEqual(['2026-11-02'])
    expect(pendingLectures(1, new Date(2026, 10, 9, 11, 50)).map((l) => l.startsAt.slice(0, 10))).toEqual([
      '2026-11-09',
      '2026-11-02',
    ])
  })

  it('a lecture rated last week does not hide this week’s (the demo ids repeat from week to week)', () => {
    addFeedback(1, 'lec-0', { overall: 4 }, new Date(2026, 10, 4, 12, 0))
    // the next Wednesday: lec-0 is now the Monday of 9 Nov, a different lecture
    expect(pendingLectures(1, new Date(2026, 10, 11, 12, 0)).map((l) => l.eventId)).toEqual(['lec-0'])
    // and the one just rated is not offered again
    expect(pendingLectures(1, new Date(2026, 10, 4, 12, 30))).toEqual([])
  })
})

describe('every lecture has its own form', () => {
  // a second lecture of the same week: its own calendar event, with its own title
  const addSecondLecture = () =>
    putEvent({
      id: 'lec-goroutines',
      title: 'Lecture 2: Goroutines',
      kind: 'lecture',
      startsAt: new Date(2026, 10, 3, 14, 0).toISOString(),
      endsAt: new Date(2026, 10, 3, 16, 0).toISOString(),
      moduleId: 'm5',
    })

  it('two lectures of a week are two rows, and each button opens the form of its own lecture', async () => {
    signIn(student)
    addSecondLecture()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/courses/m5' })
    const lectures = await block()
    expect(lectures.getAllByRole('button', { name: /Rate the lecture/ })).toHaveLength(2)

    await user.click(lectures.getByRole('button', { name: 'Rate the lecture Lecture 2: Goroutines' }))
    expect(await screen.findByRole('form', { name: 'Feedback on Lecture 2: Goroutines' })).toBeInTheDocument()
  })

  it('sending one lecture’s form leaves the other open, and the answers are stored for the right lecture', async () => {
    signIn(student)
    addSecondLecture()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/courses/m5' })

    const fill = async (title: string, overall: number) => {
      await user.click((await block()).getByRole('button', { name: `Rate the lecture ${title}` }))
      const form = within(await screen.findByRole('form', { name: `Feedback on ${title}` }))
      for (const legend of [
        /rate this lecture overall/,
        /clear were the explanations/,
        /examples, live coding/,
        /How confident/,
      ]) {
        const n = legend.test('rate this lecture overall') ? overall : 3
        await user.click(within(form.getByRole('group', { name: legend })).getByRole('radio', { name: new RegExp(`^${n}`) }))
      }
      await user.click(form.getByRole('radio', { name: 'Just right' }))
      await user.click(form.getByRole('button', { name: 'Send feedback' }))
      await screen.findByText(title, { selector: 'strong' })
    }

    await fill('Lecture 2: Goroutines', 5)
    // the first lecture is still waiting for its own form
    expect((await block()).getByRole('button', { name: 'Rate the lecture Lecture' })).toBeInTheDocument()
    expect((await block()).queryByRole('button', { name: /Goroutines/ })).toBeNull()
    expect(listFeedback().map((f) => [f.eventId, f.answers.overall])).toEqual([['lec-goroutines', 5]])

    await fill('Lecture', 2)
    expect(listFeedback().map((f) => [f.eventId, f.answers.overall])).toEqual([
      ['lec-goroutines', 5],
      ['lec-0', 2],
    ])
  })
})
