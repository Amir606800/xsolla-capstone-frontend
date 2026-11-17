import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'
import { signOutSuperAdmin } from './superAdminSession'

beforeEach(signOutSuperAdmin)
afterEach(signOutSuperAdmin)

describe('the super admin sign-in (a demo: admin / admin)', () => {
  it('sends a visitor who is not signed in to the sign-in page', async () => {
    renderWithProviders(<App />, { route: '/super-admin' })
    expect(await screen.findByRole('heading', { name: 'Sign in as super admin' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('username admin, password admin')
  })

  it('refuses a wrong password and any other username', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/super-admin/login' })
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter your username')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Username'), 'admin')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
    expect(screen.queryByRole('heading', { name: 'Schools and coordinators' })).not.toBeInTheDocument()
  })

  it('signs in as admin / admin, shows the dashboard, and signs out again', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/super-admin/login' })
    await user.type(await screen.findByLabelText('Username'), 'admin')
    await user.type(screen.getByLabelText('Password'), 'admin')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Schools and coordinators' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in as super admin' })).toBeInTheDocument()
  })
})
