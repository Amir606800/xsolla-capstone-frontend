import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AssignmentItem } from '../../types/course'
import { AssignmentCard } from './AssignmentCard'

const NOW = new Date('2026-11-14T12:00:00Z')
const task = (extra: Partial<AssignmentItem> = {}): AssignmentItem => ({
  id: 'a1',
  moduleId: 'm1',
  type: 'assignment',
  title: 'Git Basics',
  description: 'Create a repo and add a README',
  requirements: ['An account with a link'],
  dueAt: '2026-11-15T18:00:00Z',
  ...extra,
})

async function open(a: AssignmentItem) {
  render(
    <ul>
      <AssignmentCard assignment={a} now={NOW} onSubmit={vi.fn()} />
    </ul>,
  )
  await userEvent.setup().click(screen.getByRole('button', { name: /Git Basics/ }))
}

describe('an open task is a stack of labelled boxes', () => {
  it('the task: its description and requirements in a box of their own', async () => {
    await open(task())
    const box = within(screen.getByRole('region', { name: 'The task' }))
    expect(box.getByText('Create a repo and add a README')).toBeInTheDocument()
    expect(box.getByRole('heading', { name: 'Requirements' })).toBeInTheDocument()
    expect(box.getByText('An account with a link')).toBeInTheDocument()
  })

  it('nothing handed in yet: the task, then the form to hand in (no submission or feedback box)', async () => {
    await open(task())
    expect(screen.queryByRole('region', { name: 'Your submission' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Feedback' })).toBeNull()
    expect(
      within(screen.getByRole('region', { name: 'Submit your work' })).getByRole('button', { name: 'Submit' }),
    ).toBeInTheDocument()
  })

  it('what was handed in is its own box: the time, the answer and the files, each labelled', async () => {
    await open(
      task({
        submission: {
          submittedAt: '2026-11-13T06:30:00Z',
          textBody: 'github.com/sam/git-basics',
          files: [{ id: '1', name: 'Cyber_Prezentasiya.pptx', sizeBytes: 376_000 }],
        },
      }),
    )
    const work = within(screen.getByRole('region', { name: 'Your submission' }))
    expect(work.getByText(/Submitted Nov 13/)).toBeInTheDocument()
    expect(work.getByText('Your answer')).toBeInTheDocument()
    expect(work.getByText('github.com/sam/git-basics')).toBeInTheDocument()
    expect(work.getByText('Files you handed in')).toBeInTheDocument()
    expect(work.getByRole('list', { name: 'Submitted files' })).toHaveTextContent('Cyber_Prezentasiya.pptx')
    // the form to change it is a different box
    expect(
      within(screen.getByRole('region', { name: 'Hand in a new version' })).getByRole('button', { name: /Hand in new version/ }),
    ).toBeInTheDocument()
    expect(work.queryByRole('button', { name: /Hand in new version/ })).toBeNull()
  })

  it('a graded task: the feedback box carries the Graded pill and the comment; the task is locked', async () => {
    await open(
      task({
        submission: {
          submittedAt: '2026-11-13T06:30:00Z',
          textBody: 'Done',
          feedback: 'nice presentation',
          gradedAt: '2026-11-14T08:00:00Z',
        },
      }),
    )
    const feedback = within(screen.getByRole('region', { name: 'Feedback' }))
    expect(feedback.getByText('Graded')).toBeInTheDocument()
    expect(feedback.getByText(/nice presentation/)).toBeInTheDocument()
    expect(screen.getByText(/This task has been graded, so it can no longer be changed/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Hand in a new version' })).toBeNull()
  })

  it('a comment on work that is not graded is the mentor’s, in its own box', async () => {
    await open(task({ submission: { submittedAt: '2026-11-13T06:30:00Z', textBody: 'Done', feedback: 'Add a README title' } }))
    const comment = within(screen.getByRole('region', { name: 'Comment from your mentor' }))
    expect(comment.getByText(/Add a README title/)).toBeInTheDocument()
    expect(comment.queryByText('Graded')).toBeNull()
  })

  it('earlier versions sit inside the submission box', async () => {
    await open(
      task({
        submission: {
          submittedAt: '2026-11-13T06:30:00Z',
          textBody: 'Second try',
          history: [{ submittedAt: '2026-11-12T06:30:00Z', textBody: 'First try' }],
        },
      }),
    )
    const work = within(screen.getByRole('region', { name: 'Your submission' }))
    expect(work.getByText('version 2')).toBeInTheDocument()
    expect(work.getByText('Earlier versions (1)')).toBeInTheDocument()
  })
})
