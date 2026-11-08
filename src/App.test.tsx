import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithProviders } from './test/renderWithProviders'

const signedIn = () =>
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )

describe('App routing', () => {
  it('redirects guests from a protected route to the login page', async () => {
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('redirects unknown URLs to the dashboard for signed-in users', async () => {
    signedIn()
    renderWithProviders(<App />, { route: '/does-not-exist' })
    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument()
  })

  it('renders the shell: header, sidebar navigation and main section', async () => {
    signedIn()
    renderWithProviders(<App />, { route: '/dashboard' })

    expect(await screen.findByRole('banner')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()

    for (const label of ['Dashboard', 'My courses', 'Tasks', 'Calendar', 'My grades', 'My team']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('is-active')
  })

  it('navigates between sidebar sections and highlights the active one', async () => {
    signedIn()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })

    await user.click(await screen.findByRole('link', { name: 'My grades' }))
    expect(await screen.findByRole('heading', { name: 'My grades', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My grades' })).toHaveClass('is-active')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveClass('is-active')
  })

  it('logs out from the account menu and returns to the login page', async () => {
    signedIn()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })

    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(screen.getByText('sam@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(localStorage.getItem('auth_user')).toBeNull()
  })

  it('closes the account menu with Escape', async () => {
    signedIn()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })

    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
