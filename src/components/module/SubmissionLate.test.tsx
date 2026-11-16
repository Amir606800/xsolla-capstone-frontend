import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AssignmentItem } from '../../types/course'
import { SubmissionPanel } from './SubmissionPanel'

// Friday 20 Nov, noon: the deadline of a student with a Friday 1:1 (08:00) has passed
const NOW = new Date('2026-11-20T12:00:00Z')
const task = (extra: Partial<AssignmentItem> = {}): AssignmentItem => ({
  id: 'a1',
  moduleId: 'm1',
  type: 'assignment',
  title: 'Task',
  dueAt: '2026-11-20T04:00:00Z',
  dueFrom: 'one_on_one',
  ...extra,
})
const show = (a: AssignmentItem) => render(<SubmissionPanel assignment={a} onSubmit={vi.fn()} now={NOW} />)

describe('handing in after the deadline', () => {
  it('is still possible, with a warning that it will be late and make the week red', () => {
    show(task())
    expect(screen.getByRole('heading', { name: 'Submit your work' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(
      /has passed\. You can still hand in, but it will be a late submission and your week grade becomes red/,
    )
    expect(screen.getByRole('button', { name: 'Submit late' })).toBeInTheDocument()
  })

  it('work that was late says so, and a new version can still be handed in', () => {
    show(task({ submission: { submittedAt: '2026-11-20T09:30:00Z', textBody: 'My answer', late: true } }))
    expect(screen.getByText('My answer', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getAllByText('Late submission').length).toBeGreaterThan(0)
    expect(screen.getByText(/it is a late\s+submission and your week grade is red/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hand in a new version' })).toBeInTheDocument()
  })

  it('before the deadline it says when and why, and nothing about being late', () => {
    show(task({ dueAt: '2026-11-23T04:00:00Z', dueFrom: 'no_one_on_one' }))
    expect(screen.getByText(/no 1:1 booked yet, so Monday 08:00/)).toBeInTheDocument()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })
})
