import { screen, waitFor } from '@testing-library/react'
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
  it('shows the sign in form by default', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
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

  it('switches to sign up and shows name + confirm fields without forgot-password', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))

    expect(screen.getByRole('tab', { name: 'Sign up' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument()
  })

  it('sign up requires a name, 8+ char password and a matching confirmation', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    await user.type(screen.getByLabelText('Email'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm password'), 'longenough1')
    expect(submit()).toBeDisabled() // no name yet

    await user.type(screen.getByLabelText('Name'), 'Sam')
    expect(submit()).toBeEnabled()

    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'different1')
    expect(submit()).toBeDisabled()

    await user.clear(screen.getByLabelText('Password'))
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')
    expect(submit()).toBeDisabled()
  })

  it('clears password fields when switching tabs', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    expect(screen.getByLabelText('Password')).toHaveValue('')
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

  it('signs up with a name and navigates to the dashboard', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    await user.type(screen.getByLabelText('Name'), 'Sam')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.type(screen.getByLabelText('Password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm password'), 'longenough1')
    await user.click(submit())

    await waitFor(() => expect(screen.getByText('dashboard reached')).toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('auth_user')!)).toMatchObject({ name: 'Sam' })
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
