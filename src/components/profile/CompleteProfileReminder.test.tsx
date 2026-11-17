import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { mockSaveProfile } from '../../test/fixtures/profile'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.setConfig({ testTimeout: 20_000 })

const SAM = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const signIn = () => localStorage.setItem('auth_user', JSON.stringify(SAM))
const reminder = () => screen.findByRole('complementary', { name: 'Complete your profile' })

describe('the optional "complete your profile" reminder', () => {
  it('shows to someone with an empty profile, and "Maybe later" ends it for good', async () => {
    signIn()
    const user = userEvent.setup()
    const first = renderWithProviders(<App />, { route: '/' })
    await reminder()
    await user.click(screen.getByRole('button', { name: 'Maybe later' }))
    expect(screen.queryByRole('complementary', { name: 'Complete your profile' })).not.toBeInTheDocument()

    // the next visit (a new page load) does not show it again
    first.unmount()
    renderWithProviders(<App />, { route: '/' })
    await screen.findByRole('heading', { name: /Welcome/ })
    expect(screen.queryByRole('complementary', { name: 'Complete your profile' })).not.toBeInTheDocument()
  })

  it('opening the profile from it also ends it, and the profile page itself does not show it', async () => {
    signIn()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/' })
    await reminder()
    await user.click(screen.getByRole('link', { name: 'Complete profile' }))
    expect(await screen.findByRole('region', { name: 'About me' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Complete your profile' })).not.toBeInTheDocument()
  })

  it('does not show to someone who has already filled in something', async () => {
    signIn()
    mockSaveProfile(1, { bio: 'Go and cats.' })
    renderWithProviders(<App />, { route: '/' })
    await screen.findByRole('heading', { name: /Welcome/ })
    expect(screen.queryByRole('complementary', { name: 'Complete your profile' })).not.toBeInTheDocument()
  })
})
