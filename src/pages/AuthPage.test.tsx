import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import AuthPage from './AuthPage'

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/dashboard" element={<p>dashboard reached</p>} />
    </Routes>,
    { route: '/login' },
  )
}

function submit() {
  return document.querySelector<HTMLButtonElement>('button[type="submit"]')!
}

describe('AuthPage', () => {
  it('is a sign-in form only: accounts are made by an admin, so there is no sign-up', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
    expect(screen.getByText('SCHOOL BAKU')).toBeInTheDocument()
  })

  it('keeps submit disabled until email and password are valid (sign in)', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(submit()).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), 'bad-email')
    await user.type(screen.getByLabelText('Password'), 'x')
    expect(submit()).toBeDisabled()

    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'me@example.com')
    expect(submit()).toBeEnabled()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('toggles theme, applies it to <html> and persists it', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('restores a saved theme', () => {
    localStorage.setItem('theme', 'dark')
    renderPage()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('signs in and navigates to the dashboard, persisting the session', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Email'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(submit())

    expect(await screen.findByText('dashboard reached')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('auth_user')!)).toMatchObject({ email: 'me@example.com' })
  })

  it('redirects an already signed-in user straight to the dashboard', () => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: 'student' }),
    )
    renderPage()
    expect(screen.getByText('dashboard reached')).toBeInTheDocument()
  })
})
