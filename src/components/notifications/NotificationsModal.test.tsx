import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications'
import App from '../../App'
import { buildMockNotifications } from '../../mocks/notifications'
import { renderWithProviders } from '../../test/renderWithProviders'

function renderApp(route = '/dashboard') {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )
  return renderWithProviders(<App />, { route })
}

const bell = () => screen.findByRole('button', { name: /^Notifications/ })
const dialog = () => screen.getByRole('dialog', { name: 'Notifications' })
const items = () => within(within(dialog()).getByRole('list', { name: 'Notifications' })).getAllByRole('listitem')

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Notifications, \d+ unread/ }))
}

describe('Notification bell', () => {
  it('shows the unread count on the bell, with an accessible name', async () => {
    renderApp()
    const button = await screen.findByRole('button', { name: 'Notifications, 4 unread' })
    expect(button).toHaveTextContent('4')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('shows 9+ when there are many unread', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...buildMockNotifications()[0],
      id: `x${i}`,
      readAt: null,
    }))
    vi.mocked(fetchNotifications).mockResolvedValueOnce(many)
    renderApp()
    const button = await screen.findByRole('button', { name: 'Notifications, 12 unread' })
    expect(button).toHaveTextContent('9+')
  })

  it('has no badge when everything is read', async () => {
    vi.mocked(fetchNotifications).mockResolvedValueOnce(
      buildMockNotifications().map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    )
    renderApp()
    const button = await screen.findByRole('button', { name: 'Notifications' })
    expect(button.querySelector('.bell__badge')).toBeNull()
  })

  it('opens the notifications modal when clicked', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await open(user)
    expect(dialog()).toHaveAttribute('aria-modal', 'true')
  })
})

describe('Notifications modal', () => {
  it('lists all notifications, newest first, with a relative time', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)

    const rows = items()
    expect(rows).toHaveLength(8)
    expect(rows[0]).toHaveTextContent('Your task "Routing app" was graded: 94/100')
    expect(rows[0]).toHaveTextContent('2 hours ago')
    expect(rows[1]).toHaveTextContent('3 hours ago')
    expect(rows[7]).toHaveTextContent(/[A-Z][a-z]{2} \d+/) // older than a week: a date
  })

  it('marks unread items visually and for screen readers', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)

    const rows = items()
    for (const r of rows.slice(0, 4)) {
      expect(within(r).getByRole('link')).toHaveClass('is-unread')
      expect(r).toHaveTextContent('Unread')
    }
    for (const r of rows.slice(4)) {
      expect(within(r).getByRole('link')).not.toHaveClass('is-unread')
      expect(r).not.toHaveTextContent('Unread')
    }
  })

  it('each notification links to the related page', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    const links = items().map((r) => within(r).getByRole('link').getAttribute('href'))
    expect(links).toEqual([
      '/courses/m5',
      '/courses/m6',
      '/courses/m6',
      '/calendar',
      '/courses/m6',
      '/calendar',
      '/courses/m5',
      '/courses/m5',
    ])
  })

  it('clicking an already-read item does not call the API again', async () => {
    localStorage.setItem('notif_confirm', 'skip')
    vi.mocked(markNotificationRead).mockClear()
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await user.click(within(items()[4]).getByRole('link'))
    expect(markNotificationRead).not.toHaveBeenCalled()
  })

  it('"Unread" filter shows only the unread ones, and "All" brings the rest back', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)

    await user.click(within(dialog()).getByRole('button', { name: 'Unread (4)' }))
    expect(items()).toHaveLength(4)
    expect(within(dialog()).getByRole('button', { name: 'Unread (4)' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(dialog()).getByRole('button', { name: 'All' }))
    expect(items()).toHaveLength(8)
  })

  it('"Mark all as read" clears the badge and every unread marker', async () => {
    vi.mocked(markAllNotificationsRead).mockClear()
    const user = userEvent.setup()
    renderApp()
    await open(user)

    await user.click(within(dialog()).getByRole('button', { name: /Mark all as read/ }))
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1)
    for (const r of items()) expect(within(r).getByRole('link')).not.toHaveClass('is-unread')
    expect(within(dialog()).getByRole('button', { name: /Mark all as read/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Notifications' }).querySelector('.bell__badge')).toBeNull()
  })

  it('the unread filter shows an empty state once everything is read', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await user.click(within(dialog()).getByRole('button', { name: /Mark all as read/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Unread' }))
    expect(within(dialog()).getByText('No unread notifications.')).toBeInTheDocument()
    expect(within(dialog()).queryByRole('list', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no notifications at all', async () => {
    vi.mocked(fetchNotifications).mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderApp()
    await user.click(await bell())
    expect(within(dialog()).getByText(/all caught up/i)).toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: /Mark all as read/ })).toBeDisabled()
  })

  it('tells the user when marking all as read fails, and keeps the unread state', async () => {
    vi.mocked(markAllNotificationsRead).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    renderApp()
    await open(user)

    await user.click(within(dialog()).getByRole('button', { name: /Mark all as read/ }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent("Couldn't update")
    expect(screen.getByRole('button', { name: 'Notifications, 4 unread' })).toBeInTheDocument()
  })

  it('shows a loading state while notifications load', async () => {
    let release: (v: ReturnType<typeof buildMockNotifications>) => void = () => {}
    vi.mocked(fetchNotifications).mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
    const user = userEvent.setup()
    renderApp()
    await user.click(await bell())
    expect(within(dialog()).getByRole('status')).toHaveTextContent('Loading notifications')

    release(buildMockNotifications())
    expect(await within(dialog()).findByRole('list', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('shows an error with a retry button, and recovers', async () => {
    vi.mocked(fetchNotifications).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderApp()
    await user.click(await bell())

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent("couldn't load your notifications")
    await user.click(within(dialog()).getByRole('button', { name: 'Try again' }))
    expect(await within(dialog()).findByRole('list', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('closes with Escape and the close button, and focus returns to the bell', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Notifications/ })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /^Notifications/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Confirmation before opening a notification', () => {
  const confirmBox = () => within(dialog()).getByRole('region', { name: 'Open this notification?' })
  const clickMentorNotification = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(within(items()[3]).getByRole('link')) // the 1:1 meeting -> /calendar

  it('asks first instead of redirecting at once', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)

    // still on the dashboard, still in the modal, now showing the question
    expect(screen.getByRole('heading', { name: /Welcome, Sam/ })).toBeInTheDocument()
    expect(confirmBox()).toHaveTextContent('1:1 with your mentor is scheduled for Thursday at 15:00')
    expect(confirmBox()).toHaveTextContent('the Calendar')
    expect(confirmBox()).toHaveTextContent("won't be saved")
    expect(within(confirmBox()).getByRole('checkbox', { name: "Don't ask me again" })).not.toBeChecked()
    expect(screen.queryByRole('list', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('names the module for a module link', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await user.click(within(items()[1]).getByRole('link')) // /courses/m6
    expect(confirmBox()).toHaveTextContent('Module 6: Go Basics')
  })

  it('does not mark it as read or navigate until confirmed; "Stay here" goes back to the list', async () => {
    vi.mocked(markNotificationRead).mockClear()
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)

    await user.click(within(confirmBox()).getByRole('button', { name: 'Stay here' }))
    expect(markNotificationRead).not.toHaveBeenCalled()
    expect(items()).toHaveLength(8)
    expect(within(items()[3]).getByRole('link')).toHaveClass('is-unread')
    expect(screen.getByRole('heading', { name: /Welcome, Sam/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications, 4 unread' })).toBeInTheDocument()
  })

  it('"Stay here" has the initial focus (the safe choice)', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)
    expect(within(confirmBox()).getByRole('button', { name: 'Stay here' })).toHaveFocus()
  })

  it('"Open page" opens it, closes the modal and marks it as read', async () => {
    vi.mocked(markNotificationRead).mockClear()
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)
    await user.click(within(confirmBox()).getByRole('button', { name: 'Open page' }))

    expect(await screen.findByRole('heading', { name: 'Calendar', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(markNotificationRead).toHaveBeenCalledWith('n4')
    expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument()
    expect(localStorage.getItem('notif_confirm')).toBeNull() // box was not ticked: keep asking
  })

  it('"Don\'t ask me again" is remembered: the next click goes straight to the page', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)
    await user.click(within(confirmBox()).getByRole('checkbox', { name: "Don't ask me again" }))
    await user.click(within(confirmBox()).getByRole('button', { name: 'Open page' }))
    expect(await screen.findByRole('heading', { name: 'Calendar', level: 1 })).toBeInTheDocument()
    expect(localStorage.getItem('notif_confirm')).toBe('skip')

    // back on another page, a second notification opens without asking
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    await user.click(await screen.findByRole('button', { name: /^Notifications/ }))
    await user.click(within(items()[1]).getByRole('link')) // /courses/m6
    expect(await screen.findByRole('heading', { name: 'Go Basics', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Open this notification?' })).not.toBeInTheDocument()
  })

  it('ticking the box but choosing "Stay here" does not switch the question off', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)
    await user.click(within(confirmBox()).getByRole('checkbox', { name: "Don't ask me again" }))
    await user.click(within(confirmBox()).getByRole('button', { name: 'Stay here' }))
    expect(localStorage.getItem('notif_confirm')).toBeNull()
  })

  it('does not ask when the notification points to the page you are already on', async () => {
    vi.mocked(markNotificationRead).mockClear()
    const user = userEvent.setup()
    renderApp('/calendar')
    await open(user)
    await clickMentorNotification(user) // links to /calendar
    expect(screen.queryByRole('region', { name: 'Open this notification?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(markNotificationRead).toHaveBeenCalledWith('n4')
    expect(screen.getByRole('heading', { name: 'Calendar', level: 1 })).toBeInTheDocument()
  })

  it('offers a setting to turn the question back on (and off)', async () => {
    localStorage.setItem('notif_confirm', 'skip')
    const user = userEvent.setup()
    renderApp()
    await open(user)

    const setting = within(dialog()).getByRole('checkbox', { name: 'Ask before opening a notification' })
    expect(setting).not.toBeChecked()
    await user.click(setting)
    expect(localStorage.getItem('notif_confirm')).toBe('ask')

    await clickMentorNotification(user)
    expect(confirmBox()).toBeInTheDocument() // asks again
  })

  it('the setting is checked by default', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    expect(within(dialog()).getByRole('checkbox', { name: 'Ask before opening a notification' })).toBeChecked()
  })

  it('Escape closes the whole modal, even from the question, without navigating', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Welcome, Sam/ })).toBeInTheDocument()
  })

  it('the question is gone when the modal is reopened', async () => {
    const user = userEvent.setup()
    renderApp()
    await open(user)
    await clickMentorNotification(user)
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /^Notifications/ }))
    expect(screen.queryByRole('region', { name: 'Open this notification?' })).not.toBeInTheDocument()
    expect(items()).toHaveLength(8)
  })
})
