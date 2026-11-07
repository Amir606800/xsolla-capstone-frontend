import { renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { submitWork } from '../api/courses'
import App from '../App'
import { AuthProvider } from '../context/AuthProvider'
import { CoursesProvider } from '../context/CoursesProvider'
import { ThemeProvider } from '../context/ThemeProvider'
import { useCourses } from '../hooks/useCourses'
import { renderWithProviders } from '../test/renderWithProviders'

function signIn(role: 'student' | 'teacher' | 'admin') {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role }))
}

describe('Locked (future) modules', () => {
  it('a student who opens a future module by URL sees only that it is locked', async () => {
    signIn('student')
    renderWithProviders(<App />, { route: '/courses/m9' })

    expect(await screen.findByRole('heading', { name: 'Docker', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/This module opens on/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to my courses' })).toHaveAttribute('href', '/courses')

    // none of the module's content is rendered
    expect(screen.queryByRole('region', { name: 'Assignments' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Resources' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Quizzes' })).not.toBeInTheDocument()
    expect(screen.queryByText('Dockerise an app')).not.toBeInTheDocument()
    expect(screen.queryByText(/Package and run applications/)).not.toBeInTheDocument()
  })

  it('shows the real opening time on the locked screen', async () => {
    signIn('student')
    renderWithProviders(<App />, { route: '/courses/m7' })
    expect(await screen.findByText(/This module opens on/)).toHaveTextContent(/[A-Z][a-z]{2} \d+, \d\d:\d\d/)
  })

  it('the module that opens right now is available', async () => {
    signIn('student')
    renderWithProviders(<App />, { route: '/courses/m6' })
    expect(await screen.findByRole('region', { name: 'Assignments' })).toBeInTheDocument()
    expect(screen.queryByText(/This module opens on/)).not.toBeInTheDocument()
  })

  it('teachers can open future modules (in the editor)', async () => {
    signIn('teacher')
    renderWithProviders(<App />, { route: '/courses/m9' })
    expect(await screen.findByRole('region', { name: 'Tasks' })).toBeInTheDocument()
    expect(screen.queryByText(/This module opens on/)).not.toBeInTheDocument()
  })

  it('the lock goes away once the module has opened (opensAt in the past)', async () => {
    signIn('student')
    renderWithProviders(<App />, { route: '/courses/m5' }) // opened a week ago
    expect(await screen.findByRole('region', { name: 'Assignments' })).toBeInTheDocument()
  })

  it('clicking around: locked cards are not clickable', async () => {
    signIn('student')
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/courses' })
    const locked = await screen.findByLabelText('Module 8: REST APIs, locked')
    await user.click(locked)
    expect(screen.getByRole('heading', { name: 'My courses' })).toBeInTheDocument() // still on the list
  })
})

describe('submitting to a locked module', () => {
  const wrapperFor =
    () =>
    ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter>
            <CoursesProvider>{children}</CoursesProvider>
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    )

  async function loaded() {
    const hook = renderHook(() => useCourses(), { wrapper: wrapperFor() })
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))
    return hook
  }

  it('is refused for students and never reaches the API', async () => {
    signIn('student')
    const { result } = await loaded()
    await expect(result.current.submitAssignment('m8-a1', { textBody: 'sneaky', files: [] })).rejects.toThrow(
      'not open yet',
    )
    expect(submitWork).not.toHaveBeenCalled()
  })

  it('is allowed for open modules', async () => {
    signIn('student')
    const { result } = await loaded()
    await result.current.submitAssignment('m6-a2', { textBody: 'ok', files: [] })
    expect(submitWork).toHaveBeenCalledTimes(1)
  })

  it('is not blocked for teachers', async () => {
    signIn('teacher')
    const { result } = await loaded()
    await result.current.submitAssignment('m8-a1', { textBody: 'ok', files: [] })
    expect(submitWork).toHaveBeenCalledTimes(1)
  })
})
