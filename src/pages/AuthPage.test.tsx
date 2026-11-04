import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import AuthPage from './AuthPage'

function submit() {
  return document.querySelector<HTMLButtonElement>('button[type="submit"]')!
}

describe('AuthPage', () => {
  it('shows the sign in form by default', () => {
    render(<AuthPage />)
    expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
    expect(screen.getByText('SCHOOL BAKU')).toBeInTheDocument()
  })

  it('keeps submit disabled until email and password are valid (sign in)', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    expect(submit()).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), 'bad-email')
    await user.type(screen.getByLabelText('Password'), 'x')
    expect(submit()).toBeDisabled()

    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'me@example.com')
    expect(submit()).toBeEnabled()
  })

  it('switches to sign up and shows the confirm field without forgot-password', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))

    expect(screen.getByRole('tab', { name: 'Sign up' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument()
  })

  it('sign up requires 8+ char password and a matching confirmation', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    await user.type(screen.getByLabelText('Email'), 'me@example.com')

    await user.type(screen.getByLabelText('Password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')
    expect(submit()).toBeDisabled()

    await user.clear(screen.getByLabelText('Password'))
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm password'), 'different1')
    expect(submit()).toBeDisabled()

    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'longenough1')
    expect(submit()).toBeEnabled()
  })

  it('clears password fields when switching tabs', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('toggles theme, applies it to <html> and persists it', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('restores a saved theme', () => {
    localStorage.setItem('theme', 'dark')
    render(<AuthPage />)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
