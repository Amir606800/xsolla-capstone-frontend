import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AssignmentItem } from '../../types/course'
import { SubmissionPanel } from './SubmissionPanel'

const NOW = new Date('2026-11-20T12:00:00Z')
const task = (extra: Partial<AssignmentItem> = {}): AssignmentItem => ({
  id: 'a1',
  moduleId: 'm1',
  type: 'assignment',
  title: 'Task',
  dueAt: '2026-11-25T18:00:00Z',
  submission: { submittedAt: '2026-11-10T10:00:00Z', textBody: 'My answer' },
  ...extra,
})
const show = (a: AssignmentItem, closesAt?: string) => render(<SubmissionPanel assignment={a} onSubmit={vi.fn()} now={NOW} closesAt={closesAt} />)

describe('a task after its module closed', () => {
  it('shows what the student handed in, and no form to change it', () => {
    show(task(), '2026-11-19T23:59:00Z')
    expect(screen.getByText('My answer')).toBeInTheDocument()
    expect(screen.getByText(/has passed, so no new version can be handed in\. You can still read what you handed in\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Submit|Hand in/i })).not.toBeInTheDocument()
  })

  it('is still open for hand-ins while the module is open', () => {
    show(task(), '2026-12-01T00:00:00Z')
    expect(screen.getByRole('heading', { name: 'Hand in a new version' })).toBeInTheDocument()
  })
})
