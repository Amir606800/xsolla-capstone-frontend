import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { LINKS } from '../config/links'
import { renderWithProviders } from '../test/renderWithProviders'
import { goTo, prefersReducedMotion } from '../utils/teleport'
import { TELEPORT_MS } from './OfficeTourPage'

vi.mock('../utils/teleport', () => ({ goTo: vi.fn(), prefersReducedMotion: vi.fn(() => false) }))

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(goTo).mockClear()
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
})

function renderAs(roles: string[], route = '/office-tour') {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@x', roles }))
  return renderWithProviders(<App />, { route })
}
const tourLink = () => screen.findByRole('link', { name: 'Start the 360° office tour' })

describe('Office tour', () => {
  it('tells the story, then links the blurred preview to the tour', async () => {
    renderAs(['student'])
    expect(await screen.findByRole('heading', { name: 'Welcome to your office', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/starts at the same door/)).toBeInTheDocument()
    expect(await tourLink()).toHaveAttribute('href', LINKS.officeTour)
  })

  it('falls back to a stand-in picture when there is no screenshot yet', async () => {
    renderAs(['student'])
    const tour = await tourLink()
    fireEvent.error(tour.querySelector('img')!)
    expect(tour.querySelector('img')).toBeNull()
    expect(tour.querySelector('.tour__art')).not.toBeNull()
  })

  it('a click plays the teleport, then goes to the tour in this tab', async () => {
    renderAs(['student'])
    const tour = await tourLink()
    vi.useFakeTimers()
    fireEvent.click(tour)
    expect(screen.getByRole('status')).toHaveTextContent('Teleporting to the office')
    expect(goTo).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(TELEPORT_MS))
    expect(goTo).toHaveBeenCalledWith(LINKS.officeTour)
    // a second click while it plays does not start another
    fireEvent.click(tour)
    expect(goTo).toHaveBeenCalledTimes(1)
  })

  it('with reduced motion it goes straight to the tour', async () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    renderAs(['student'])
    fireEvent.click(await tourLink())
    expect(goTo).toHaveBeenCalledWith(LINKS.officeTour)
    expect(screen.queryByText(/Teleporting/)).not.toBeInTheDocument()
  })

  it('ctrl/cmd click is left to the browser (a new tab), without the teleport', async () => {
    renderAs(['student'])
    const tour = await tourLink()
    fireEvent.click(tour, { ctrlKey: true })
    fireEvent.click(tour, { metaKey: true })
    expect(goTo).not.toHaveBeenCalled()
    expect(screen.queryByText(/Teleporting/)).not.toBeInTheDocument()
  })

  it('coming back with Back clears the teleport', async () => {
    renderAs(['student'])
    fireEvent.click(await tourLink())
    expect(screen.getByText(/Teleporting/)).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
    })
    expect(screen.queryByText(/Teleporting/)).not.toBeInTheDocument()
  })

  it.each([[['student']], [['mentor', 'lecturer']], [['lecturer']]])('is in the sidebar for %j and opens from there', async (roles) => {
    const user = userEvent.setup()
    renderAs(roles, '/dashboard')
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    await user.click(within(nav).getByRole('link', { name: 'Office tour' }))
    expect(await screen.findByRole('heading', { name: 'Welcome to your office' })).toBeInTheDocument()
  })
})

describe('Team tools in the sidebar', () => {
  it('links to Slack and GitLab in a new tab', async () => {
    renderAs(['student'], '/dashboard')
    const tools = await screen.findByRole('group', { name: 'Team tools' })
    const slack = within(tools).getByRole('link', { name: 'Slack (opens in a new tab)' })
    const gitlab = within(tools).getByRole('link', { name: 'GitLab (opens in a new tab)' })
    expect(slack).toHaveAttribute('href', LINKS.slack)
    expect(gitlab).toHaveAttribute('href', LINKS.gitlab)
    for (const a of [slack, gitlab]) expect(a).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
