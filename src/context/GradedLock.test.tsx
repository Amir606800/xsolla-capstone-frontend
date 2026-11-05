import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { submitWork } from '../api/courses'
import { useCourses } from '../hooks/useCourses'
import { renderWithProviders } from '../test/renderWithProviders'
import { CoursesProvider } from './CoursesProvider'

/** A button per task, so the test can try to hand work in directly through the context. */
function Probe({ ids }: { ids: string[] }) {
  const { status, submitAssignment } = useCourses()
  if (status !== 'ready') return <p>loading</p>
  return (
    <>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => submitAssignment(id, { textBody: 'x', files: [] }).catch((e: Error) => (document.title = e.message))}
        >
          {id}
        </button>
      ))}
    </>
  )
}

function renderProbe(ids: string[]) {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: 'student' }))
  return renderWithProviders(
    <CoursesProvider>
      <Probe ids={ids} />
    </CoursesProvider>,
  )
}

describe('graded work is final', () => {
  it('refuses to accept work for a task that was already graded, and never calls the server', async () => {
    vi.mocked(submitWork).mockClear()
    const user = userEvent.setup()
    renderProbe(['m1-a1'])
    await user.click(await screen.findByRole('button', { name: 'm1-a1' })) // module 1 is graded in the mock
    await waitFor(() => expect(document.title).toBe('This task has already been graded'))
    expect(submitWork).not.toHaveBeenCalled()
  })

  it('still accepts a replacement for work that was submitted but not graded yet', async () => {
    vi.mocked(submitWork).mockClear()
    const user = userEvent.setup()
    renderProbe(['m6-a1'])
    await user.click(await screen.findByRole('button', { name: 'm6-a1' })) // submitted, awaiting a grade
    await waitFor(() => expect(submitWork).toHaveBeenCalledTimes(1))
  })

  it('accepts a first submission', async () => {
    vi.mocked(submitWork).mockClear()
    const user = userEvent.setup()
    renderProbe(['m6-a2'])
    await user.click(await screen.findByRole('button', { name: 'm6-a2' }))
    await waitFor(() => expect(submitWork).toHaveBeenCalledTimes(1))
  })
})
