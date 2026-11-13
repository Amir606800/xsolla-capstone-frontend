import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as courses from '../../api/courses'
import App from '../../App'
import { listModules, putItem, setLecturer } from '../../mocks/contentEdits'
import type { QuizQuestion } from '../../types/course'
import { renderWithProviders } from '../../test/renderWithProviders'

const tenQuestions: QuizQuestion[] = Array.from({ length: 10 }, (_, i) => ({
  id: `q-${i + 1}`,
  prompt: `Concept question ${i + 1}?`,
  options: ['Option A', 'Option B', 'Option C', 'Option D'],
  correct: i % 4,
}))

function asLecturer() {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 907, name: 'Rashad Aliyev', email: 'rashad@xsolla.school', roles: ['lecturer'] }),
  )
}

function asStudent() {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 42, name: 'Leyla Mammadova', email: 'leyla@xsolla.school', roles: ['student'] }),
  )
}

describe('AI Quiz generation & student quiz flow', () => {
  it('lecturer generates an AI quiz in the background from a lesson material', async () => {
    asLecturer()
    // quiz tools are for the lecturers assigned to the module
    setLecturer('m6', 907, true)
    renderWithProviders(<App />, { route: '/courses/m6' })
    const user = userEvent.setup()

    const aiBtn = await screen.findByRole('button', { name: 'AI Quiz from Go Basics - lecture slides' })
    await user.click(aiBtn)

    const dialog = await screen.findByRole('dialog', { name: 'AI Quiz' })
    expect(within(dialog).getByText(/10 multiple-choice questions/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Generate AI Quiz' }))

    expect(courses.generateAiQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ moduleId: 'm6', contentItemId: 'm6-r1' }),
      expect.anything(),
    )
    expect(await screen.findByText(/AI quiz generation started in the background/)).toBeInTheDocument()

    const quizzesRegion = screen.getByRole('region', { name: 'Quizzes' })
    expect(within(quizzesRegion).getByText('AI Quiz: Go Basics - lecture slides')).toBeInTheDocument()
    expect(within(quizzesRegion).getByText(/Generating 10 English multiple-choice questions/)).toBeInTheDocument()
  })

  it('non-lecturers do not see AI Quiz or New quiz creation controls', async () => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }),
    )
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    await screen.findByRole('heading', { name: 'Go Basics', level: 1 })
    expect(screen.queryByRole('button', { name: 'New quiz' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /AI Quiz/ })).not.toBeInTheDocument()
  })

  it('student takes a 10-question quiz and sees score and correct answers after finishing', async () => {
    putItem({
      id: 'quiz-ai-10',
      moduleId: 'm6',
      type: 'quiz',
      title: 'Go Slides AI Quiz',
      description: 'Generated from lecture slides.',
      status: 'ready',
      isAiGenerated: true,
      questions: tenQuestions,
    })

    asStudent()
    renderWithProviders(<App />, { route: '/courses/m6' })
    const user = userEvent.setup()

    const quizzesRegion = await screen.findByRole('region', { name: 'Quizzes' })
    expect(within(quizzesRegion).getByText('Go Slides AI Quiz')).toBeInTheDocument()
    expect(within(quizzesRegion).getByText('10 questions')).toBeInTheDocument()
    expect(screen.queryByText('Concept question 1?')).not.toBeInTheDocument()

    await user.click(within(quizzesRegion).getByRole('button', { name: 'Start quiz' }))
    const dialog = await screen.findByRole('dialog', { name: 'Go Slides AI Quiz' })

    const radios = within(dialog).getAllByRole('radio')
    expect(radios).toHaveLength(40)

    for (let i = 0; i < 10; i++) {
      const choice = i < 8 ? i % 4 : (i + 1) % 4
      await user.click(radios[i * 4 + choice])
    }

    await user.click(within(dialog).getByRole('button', { name: 'Finish quiz' }))

    await waitFor(() => {
      expect(within(dialog).getByText(/Result: 8 \/ 10 \(80%\)/)).toBeInTheDocument()
    })
    expect(within(dialog).getAllByText('Your answer · Correct')).toHaveLength(8)
    expect(within(dialog).getAllByText('Correct answer')).toHaveLength(2)
    expect(within(dialog).getAllByText('Your answer')).toHaveLength(2)
    expect(listModules().find((m) => m.id === 'm6')).toBeDefined()
    vi.clearAllMocks()
  })
})
