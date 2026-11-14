import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'

describe('Forgot password', () => {
  it('the sign-in link leads to a page that says to ask a mentor or the admin, and back', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/login' })
    await user.click(await screen.findByRole('link', { name: 'Forgot password?' }))
    expect(await screen.findByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument()
    expect(screen.getByText('To reset your password, please contact your mentor or the admin.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to sign in' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
