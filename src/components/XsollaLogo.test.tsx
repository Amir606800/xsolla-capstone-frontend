import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'
import { XsollaLogo } from './XsollaLogo'
import { render } from '@testing-library/react'

describe('XsollaLogo', () => {
  it('is an image named "Xsolla"', () => {
    render(<XsollaLogo />)
    expect(screen.getByRole('img', { name: 'Xsolla' })).toBeInTheDocument()
  })

  it('takes its colour from the text colour, so it can be black or white', () => {
    const { container } = render(<XsollaLogo className="x" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('fill', 'currentColor')
    expect(svg).toHaveClass('x')
    expect(svg.querySelectorAll('path')).toHaveLength(5) // X, S-ring (O), S, L, A shapes
    for (const p of svg.querySelectorAll('path')) expect(p).not.toHaveAttribute('fill', expect.stringMatching(/^#/))
  })

  it('appears in the header of the signed-in app and on the login page', async () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: 'student' }))
    const app = renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('banner')).toContainElement(screen.getByRole('img', { name: 'Xsolla' }))
    app.unmount()

    localStorage.clear()
    renderWithProviders(<App />, { route: '/login' })
    expect(await screen.findByRole('img', { name: 'Xsolla' })).toBeInTheDocument()
  })
})
