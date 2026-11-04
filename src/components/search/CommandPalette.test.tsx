import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { renderWithProviders } from '../../test/renderWithProviders'

function renderApp(route = '/dashboard', role: 'student' | 'teacher' = 'student') {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role }))
  return renderWithProviders(<App />, { route })
}

const trigger = () => screen.findByRole('button', { name: /^Search courses, tasks, pages/ })
const dialog = () => screen.getByRole('dialog', { name: 'Search' })
const input = () => within(dialog()).getByRole('combobox')
const options = () => within(dialog()).queryAllByRole('option')

async function openByClick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await trigger())
}

describe('Search in the header', () => {
  it('shows a search bar in the header with the keyboard shortcut', async () => {
    renderApp()
    const bar = await trigger()
    expect(bar).toHaveTextContent('Search courses, tasks, pages…')
    expect(bar).toHaveTextContent(/Ctrl K|⌘ K/)
    expect(bar).toHaveAttribute('aria-keyshortcuts', expect.stringMatching(/^(Control|Meta)\+K$/))
    expect(bar.closest('header')).not.toBeNull()
  })

  it('opens on click with the search box focused', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    expect(dialog()).toBeInTheDocument()
    expect(input()).toHaveFocus()
  })

  it('opens with Ctrl+K from anywhere, and with the small icon button', async () => {
    const user = userEvent.setup()
    renderApp()
    await trigger()
    await user.keyboard('{Control>}k{/Control}')
    expect(dialog()).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(dialog()).toBeInTheDocument()
  })

  it('Ctrl+K does not trigger the browser default', async () => {
    renderApp()
    await trigger()
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('shows the pages and open modules when the box is empty', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    const labels = options().map((o) => o.textContent)
    expect(labels.some((l) => l?.includes('Dashboard'))).toBe(true)
    expect(labels.some((l) => l?.includes('Calendar'))).toBe(true)
    expect(labels.some((l) => l?.includes('Go Basics'))).toBe(true)
    expect(labels.some((l) => l?.includes('HTTP server'))).toBe(false) // assignments only when searching
  })

  it('filters as you type, with group headings', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'http')

    expect(options()).toHaveLength(1)
    expect(options()[0]).toHaveTextContent('HTTP server')
    expect(options()[0]).toHaveTextContent('Go Basics') // its module as the hint
    expect(within(dialog()).getByText('Assignments')).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'zzzqqq')
    expect(options()).toHaveLength(0)
    expect(within(dialog()).getByRole('status')).toHaveTextContent('No results for “zzzqqq”')
  })

  it('never shows locked modules or their tasks to a student', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'docker')
    expect(options()).toHaveLength(0)
    await user.clear(input())
    await user.type(input(), 'schema')
    expect(options()).toHaveLength(0)
  })

  it('shows them to a teacher', async () => {
    const user = userEvent.setup()
    renderApp('/dashboard', 'teacher')
    await openByClick(user)
    await user.type(input(), 'docker')
    expect(options().length).toBeGreaterThan(0)
    expect(options()[0]).toHaveTextContent('Docker')
  })

  it('moves the highlight with the arrow keys and wraps around', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'go') // several matches

    const selected = () => options().findIndex((o) => o.getAttribute('aria-selected') === 'true')
    expect(selected()).toBe(0)
    await user.keyboard('{ArrowDown}')
    expect(selected()).toBe(1)
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(selected()).toBe(options().length - 1) // wrapped to the last
    await user.keyboard('{ArrowDown}')
    expect(selected()).toBe(0)
  })

  it('exposes the highlighted option to screen readers (aria-activedescendant)', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'go')
    const id = input().getAttribute('aria-activedescendant')!
    expect(document.getElementById(id)).toBe(options()[0])
    await user.keyboard('{ArrowDown}')
    expect(document.getElementById(input().getAttribute('aria-activedescendant')!)).toBe(options()[1])
  })

  it('Enter opens the highlighted result and closes the search', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'calendar')
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Calendar', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('an assignment result opens its module', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'http server')
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Go Basics', level: 1 })).toBeInTheDocument()
  })

  it('clicking a result opens it', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.click(options().find((o) => o.textContent?.includes('My courses'))!)
    expect(await screen.findByRole('heading', { name: 'My courses', level: 1 })).toBeInTheDocument()
  })

  it('hovering a result highlights it', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.hover(options()[2])
    expect(options()[2]).toHaveAttribute('aria-selected', 'true')
    expect(options()[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('Enter with no results does nothing', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'zzzqqq{Enter}')
    expect(dialog()).toBeInTheDocument()
  })

  it('opens fresh every time (the previous query is cleared) and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    renderApp()
    await openByClick(user)
    await user.type(input(), 'http')
    await user.keyboard('{Escape}')
    expect(await trigger()).toHaveFocus()
    await openByClick(user)
    expect(input()).toHaveValue('')
  })
})
