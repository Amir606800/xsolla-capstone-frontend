import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { CoursesProvider } from '../context/CoursesProvider'
import { DashboardLayoutProvider } from '../context/DashboardLayoutProvider'
import { StandingsProvider } from '../context/StandingsProvider'
import { renderWithProviders } from '../test/renderWithProviders'
import DashboardPage from './DashboardPage'

const KEY = 'dashboard_layout:1'

function renderDashboard() {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: 'student' }))
  return renderWithProviders(
    <CoursesProvider>
      <DashboardLayoutProvider>
        <StandingsProvider>
          <DashboardPage />
        </StandingsProvider>
      </DashboardLayoutProvider>
    </CoursesProvider>,
  )
}

/** Widget titles in the order they appear on the page. */
const order = () => Array.from(document.querySelectorAll('[data-widget]')).map((w) => w.getAttribute('data-widget'))
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as { id: string; size: string; visible: boolean }[]

async function startEditing() {
  const user = userEvent.setup()
  renderDashboard()
  await screen.findByRole('heading', { name: 'Progress' })
  await user.click(screen.getByRole('button', { name: 'Edit dashboard' }))
  return user
}

beforeEach(() => localStorage.removeItem(KEY))

describe('Dashboard widgets: default view', () => {
  it('shows the five widgets in the default order, without any editing controls', async () => {
    renderDashboard()
    await screen.findByRole('heading', { name: 'Progress' })
    expect(order()).toEqual(['progress', 'current-task', 'deadlines', 'grades', 'activity'])
    expect(screen.queryByRole('group', { name: /controls$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument()
  })

  it('has no Edit button while the course is still loading', () => {
    renderDashboard()
    expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument()
  })
})

describe('Dashboard widgets: current task', () => {
  it('shows this week\'s module, how far along it is and the next task', async () => {
    renderDashboard()
    const card = (await screen.findByRole('heading', { name: 'Current task' })).closest('section')!
    expect(card).toHaveTextContent('Module 6 · Go Basics')
    expect(within(card).getByRole('progressbar', { name: 'Module task progress' })).toBeInTheDocument()
    expect(card).toHaveTextContent(/\d of \d tasks submitted/)
    expect(card).toHaveTextContent('Next task')
    expect(within(card).getByRole('link', { name: 'Open module' })).toHaveAttribute('href', '/courses/m6')
  })
})

describe('Dashboard widgets: recent activity', () => {
  it('lists what happened lately, only from modules the student can see', async () => {
    renderDashboard()
    const card = (await screen.findByRole('heading', { name: 'Recent activity' })).closest('section')!
    expect(within(card).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(card).toHaveTextContent(/Submitted|Graded|Opened/)
    expect(card).not.toHaveTextContent('Docker')
  })
})

describe('Dashboard widgets: edit mode', () => {
  it('shows controls on every widget, plus Add / Reset / Done', async () => {
    await startEditing()
    expect(screen.getAllByRole('group', { name: /controls$/ })).toHaveLength(5)
    expect(screen.getByRole('button', { name: /^Add widget/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag Recent grades' })).toBeInTheDocument()
  })

  it('"Done" leaves edit mode', async () => {
    const user = await startEditing()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('group', { name: /controls$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument()
  })

  it('makes the content inert so a click cannot open a link by accident', async () => {
    await startEditing()
    const body = document.querySelector('[data-widget="current-task"] .widget__body')!
    expect(body).toHaveAttribute('inert')
  })

  it('moves a widget earlier and later, and saves the order', async () => {
    const user = await startEditing()
    await user.click(screen.getByRole('button', { name: 'Move Recent activity earlier' }))
    expect(order()).toEqual(['progress', 'current-task', 'deadlines', 'activity', 'grades'])
    await user.click(screen.getByRole('button', { name: 'Move Progress later' }))
    expect(order().slice(0, 2)).toEqual(['current-task', 'progress'])
    expect(saved().map((w) => w.id)).toEqual(order())
  })

  it('cannot move the first widget earlier or the last one later', async () => {
    await startEditing()
    expect(screen.getByRole('button', { name: 'Move Progress earlier' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Recent activity later' })).toBeDisabled()
  })

  it('changes the width and saves it', async () => {
    const user = await startEditing()
    const widths = screen.getByRole('group', { name: 'Recent grades width' })
    expect(within(widths).getByRole('button', { name: 'Medium width' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(widths).getByRole('button', { name: 'Full width' }))
    expect(document.querySelector('[data-widget="grades"]')).toHaveClass('widget--full')
    expect(within(widths).getByRole('button', { name: 'Full width' })).toHaveAttribute('aria-pressed', 'true')
    expect(saved().find((w) => w.id === 'grades')?.size).toBe('full')
  })

  it('does not offer a width that is too small for the module path', async () => {
    await startEditing()
    const widths = screen.getByRole('group', { name: 'Progress width' })
    expect(within(widths).queryByRole('button', { name: 'Small width' })).not.toBeInTheDocument()
    expect(within(widths).getByRole('button', { name: 'Full width' })).toBeInTheDocument()
  })

  it('removes a widget and lets the student add it back from the pop-up', async () => {
    const user = await startEditing()
    await user.click(screen.getByRole('button', { name: 'Remove Recent grades' }))
    expect(order()).not.toContain('grades')
    expect(screen.queryByRole('heading', { name: 'Recent grades' })).not.toBeInTheDocument()
    expect(saved().find((w) => w.id === 'grades')?.visible).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Add widget (1)' }))
    const dialog = screen.getByRole('dialog', { name: 'Add widgets' })
    expect(within(dialog).getByText('Recent grades')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add Recent grades' }))

    expect(order().at(-1)).toBe('grades') // comes back at the end
    expect(within(dialog).getByText(/already on your dashboard/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('heading', { name: 'Recent grades' })).toBeInTheDocument()
  })

  it('"Reset to default" restores order, sizes and removed widgets', async () => {
    const user = await startEditing()
    await user.click(screen.getByRole('button', { name: 'Remove Recent grades' }))
    await user.click(screen.getByRole('button', { name: 'Move Recent activity earlier' }))
    await user.click(within(screen.getByRole('group', { name: 'Upcoming deadlines width' })).getByRole('button', { name: 'Small width' }))

    await user.click(screen.getByRole('button', { name: 'Reset to default' }))
    expect(order()).toEqual(['progress', 'current-task', 'deadlines', 'grades', 'activity'])
    expect(document.querySelector('[data-widget="deadlines"]')).toHaveClass('widget--lg')
  })

  it('shows an empty state with an Add button when every widget was removed', async () => {
    const user = await startEditing()
    for (const name of ['Progress', 'Current task', 'Upcoming deadlines', 'Recent grades', 'Recent activity']) {
      await user.click(screen.getByRole('button', { name: `Remove ${name}` }))
    }
    expect(screen.getByText('Your dashboard is empty.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a widget' }))
    expect(screen.getByRole('dialog', { name: 'Add widgets' })).toBeInTheDocument()
  })
})

describe('Dashboard widgets: remembered layout', () => {
  it('opens with the saved layout', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'activity', size: 'full', visible: true },
        { id: 'progress', size: 'full', visible: true },
        { id: 'grades', size: 'sm', visible: false },
      ]),
    )
    renderDashboard()
    await screen.findByRole('heading', { name: 'Progress' })
    expect(order()).toEqual(['activity', 'progress', 'current-task', 'deadlines']) // new ones appended, grades hidden
    expect(document.querySelector('[data-widget="activity"]')).toHaveClass('widget--full')
  })

  it('survives broken storage', async () => {
    localStorage.setItem(KEY, '{{{')
    renderDashboard()
    await screen.findByRole('heading', { name: 'Progress' })
    expect(order()).toHaveLength(5)
  })

  it('is kept separately for each user', async () => {
    localStorage.setItem('dashboard_layout:99', JSON.stringify([{ id: 'grades', size: 'sm', visible: false }]))
    renderDashboard() // user 1
    await screen.findByRole('heading', { name: 'Progress' })
    expect(order()).toContain('grades')
  })
})
