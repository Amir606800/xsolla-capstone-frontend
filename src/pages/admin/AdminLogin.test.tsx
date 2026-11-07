import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../../api/auth'
import { DEMO_ADMIN } from '../../api/auth.mock'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

afterEach(() => vi.mocked(authApi.logout).mockClear())

const savedUser = () => JSON.parse(localStorage.getItem('auth_user') ?? 'null')
function signedInAs(roles: string[]) {
  localStorage.setItem('auth_user', JSON.stringify({ id: 7, name: 'Someone', email: 'someone@x.co', roles }))
}

async function fillAndSubmit(email: string, password = 'secret') {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  return user
}

describe('Admin sign-in', () => {
  it('is a plain e-mail + password form: no sign-up, no Google', async () => {
    renderWithProviders(<App />, { route: '/admin/login' })
    expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.queryByRole('tab', { name: 'Sign up' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Continue with Google')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Go to the LMS sign-in/ })).toHaveAttribute('href', '/login')
  })

  it('checks the fields before sending anything', async () => {
    renderWithProviders(<App />, { route: '/admin/login' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('an admin signs in and lands on the admin dashboard', async () => {
    renderWithProviders(<App />, { route: '/admin/login' })
    await fillAndSubmit(DEMO_ADMIN.email)
    expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(DEMO_ADMIN.email)).toBeInTheDocument()
    expect(savedUser()).toMatchObject({ email: DEMO_ADMIN.email, roles: ['admin'] })
  })

  it('refuses an account without the admin role and leaves nobody signed in', async () => {
    renderWithProviders(<App />, { route: '/admin/login' })
    await fillAndSubmit('lecturer@xsolla.school')
    expect(await screen.findByRole('alert')).toHaveTextContent('This account does not have admin access')
    expect(authApi.logout).toHaveBeenCalledTimes(1)
    expect(savedUser()).toBeNull()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Overview', level: 1 })).not.toBeInTheDocument()
  })

  it('shows the error from a failed login', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('invalid credentials'))
    renderWithProviders(<App />, { route: '/admin/login' })
    await fillAndSubmit(DEMO_ADMIN.email, 'wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid credentials')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('the offline demo button fills in the demo admin', async () => {
    renderWithProviders(<App />, { route: '/admin/login' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'use the demo admin account' }))
    expect(screen.getByLabelText('Email')).toHaveValue(DEMO_ADMIN.email)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument()
  })

  it('the password can be shown and hidden', async () => {
    renderWithProviders(<App />, { route: '/admin/login' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })
})

describe('Admin section access', () => {
  it('guests who open /admin are sent to the admin sign-in', async () => {
    renderWithProviders(<App />, { route: '/admin' })
    expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
  })

  it.each([[['student']], [['mentor', 'lecturer']]])('%j cannot open /admin and goes back to the LMS', async (roles) => {
    signedInAs(roles)
    renderWithProviders(<App />, { route: '/admin' })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Overview', level: 1 })).not.toBeInTheDocument())
    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('an admin is kept out of the LMS pages and taken to the admin section', async () => {
    signedInAs(['admin'])
    renderWithProviders(<App />, { route: '/courses' })
    expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })

  it('an admin who opens the admin sign-in goes straight to the dashboard', async () => {
    signedInAs(['admin'])
    renderWithProviders(<App />, { route: '/admin/login' })
    expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument()
  })

  it('unknown admin addresses fall back to the admin dashboard', async () => {
    signedInAs(['admin'])
    renderWithProviders(<App />, { route: '/admin/nothing-here' })
    expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument()
  })

  it('signing out returns to the admin sign-in', async () => {
    signedInAs(['admin'])
    renderWithProviders(<App />, { route: '/admin' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
    expect(savedUser()).toBeNull()
  })
})
