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

  it('the teleport starts from the picture in the frame and only moves once it is painted', async () => {
    renderAs(['student'])
    const tour = await tourLink()
    const picture = tour.querySelector('.tour__view')!
    vi.spyOn(picture, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 50, width: 512, height: 288 } as DOMRect)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(576)
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))

    fireEvent.click(tour)
    const overlay = document.querySelector<HTMLElement>('.teleport')!
    expect(overlay.style.getPropertyValue('--t')).toBe('100px')
    expect(overlay.style.getPropertyValue('--l')).toBe('50px')
    expect(overlay.style.getPropertyValue('--sx')).toBe('0.5')
    expect(overlay.style.getPropertyValue('--sy')).toBe('0.5')
    // a sharp picture under a blurred copy that fades out
    expect(overlay.querySelector('.teleport__sharp')).not.toBeNull()
    expect(overlay.querySelector('.teleport__blurred')).not.toBeNull()

    expect(overlay).not.toHaveClass('is-playing')
    act(() => frames.shift()!(0))
    expect(overlay).not.toHaveClass('is-playing')
    act(() => frames.shift()!(16))
    expect(overlay).toHaveClass('is-playing')
    vi.restoreAllMocks()
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

describe('Office tour and team tools for the admin', () => {
  const admin = () =>
    localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))

  it('the admin section list has the office tour, and it opens inside the admin area', async () => {
    admin()
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin' })
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    await user.click(within(nav).getByRole('link', { name: 'Office tour' }))
    expect(await screen.findByRole('heading', { name: 'Welcome to your office', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Admin sections' })).toBeInTheDocument()
    expect(await tourLink()).toHaveAttribute('href', LINKS.officeTour)
  })

  it('links to Slack and GitLab in a new tab', async () => {
    admin()
    renderWithProviders(<App />, { route: '/admin' })
    const tools = await screen.findByRole('group', { name: 'Team tools' })
    const slack = within(tools).getByRole('link', { name: 'Slack (opens in a new tab)' })
    const gitlab = within(tools).getByRole('link', { name: 'GitLab (opens in a new tab)' })
    expect(slack).toHaveAttribute('href', LINKS.slack)
    expect(gitlab).toHaveAttribute('href', LINKS.gitlab)
    for (const a of [slack, gitlab]) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    }
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
