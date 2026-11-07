import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { listBroadcasts } from '../../mocks/broadcasts'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const form = () => screen.findByRole('form', { name: 'New announcement' })
const dialog = () => screen.findByRole('dialog')

async function write(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(within(await form()).getByLabelText('Message'), text)
}

describe('Admin: notifications', () => {
  it('starts with an empty history and shows how many people each choice reaches', async () => {
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const f = within(await form())
    expect(await screen.findByText('Nothing has been sent yet.')).toBeInTheDocument()
    // 29 students, 6 mentors, 3 lecturers; 37 different people (a mentor who lectures counts once)
    expect(await f.findByRole('radio', { name: /^Everyone\s*37 people/ })).toBeChecked()
    expect(f.getByRole('radio', { name: /^Students\s*29 people/ })).toBeInTheDocument()
    expect(f.getByRole('radio', { name: /^Mentors\s*6 people/ })).toBeInTheDocument()
    expect(f.getByRole('radio', { name: /^Lecturers\s*3 people/ })).toBeInTheDocument()
  })

  it('needs a message, and keeps it to 500 characters', async () => {
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const user = userEvent.setup()
    const f = within(await form())
    await user.click(f.getByRole('button', { name: 'Send announcement' }))
    expect(f.getByText('Write the announcement.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(f.getByText('0 / 500')).toBeInTheDocument()
    fireEvent.change(f.getByLabelText('Message'), { target: { value: 'x'.repeat(501) } })
    expect(f.getByText('501 / 500')).toBeInTheDocument()
    expect(f.getByText('At most 500 characters.')).toBeInTheDocument()
  })

  it('asks before sending, says who gets it, and Cancel sends nothing', async () => {
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const user = userEvent.setup()
    await write(user, 'No classes on Friday.')
    await user.click(screen.getByRole('radio', { name: /^Students/ }))
    await user.click(screen.getByRole('button', { name: 'Send announcement' }))
    const confirm = within(await dialog())
    expect(confirm.getByText('“No classes on Friday.”')).toBeInTheDocument()
    expect(confirm.getByText('It goes to 29 people and cannot be taken back.')).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Cancel' }))
    expect(listBroadcasts()).toEqual([])
  })

  it('sends it, clears the form and lists it under "Sent so far"', async () => {
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const user = userEvent.setup()
    await write(user, 'No classes on Friday.')
    await user.click(screen.getByRole('radio', { name: /^Students/ }))
    await user.selectOptions(screen.getByLabelText('Opens (optional)'), 'Calendar')
    await user.click(screen.getByRole('button', { name: 'Send announcement' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Sent to 29 people (students).')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toHaveValue('')
    const table = await screen.findByRole('table', { name: 'Sent announcements' })
    const row = within(table).getByText('No classes on Friday.').closest('tr')!
    expect(within(row).getByText('Students')).toBeInTheDocument()
    expect(within(row).getByText('29 people')).toBeInTheDocument()
    expect(listBroadcasts()[0]).toMatchObject({ message: 'No classes on Friday.', audience: 'students', link: '/calendar', sentBy: 'School Admin', recipients: 29 })
    expect(screen.queryByText('Nothing has been sent yet.')).not.toBeInTheDocument()
  })

  it('the history keeps what was sent before, newest first, and sorts by a column', async () => {
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const user = userEvent.setup()
    for (const [text, who] of [
      ['First', /^Everyone/],
      ['Second', /^Mentors/],
    ] as const) {
      await write(user, text)
      await user.click(screen.getByRole('radio', { name: who }))
      await user.click(screen.getByRole('button', { name: 'Send announcement' }))
      await user.click(within(await dialog()).getByRole('button', { name: 'Send' }))
      await screen.findByText(new RegExp(`^Sent to .*\\(${text === 'First' ? 'everyone' : 'mentors'}\\)`))
    }
    const table = await screen.findByRole('table', { name: 'Sent announcements' })
    const messages = () => within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[3].textContent)
    expect(messages()).toEqual(['Second', 'First'])
    await user.click(within(table).getByRole('button', { name: 'Reached' }))
    expect(messages()).toEqual(['Second', 'First']) // fewest people first: 6, then 37
    await user.click(within(table).getByRole('button', { name: 'Reached' }))
    expect(messages()).toEqual(['First', 'Second'])
  })
})

describe('Announcements in the notification bell', () => {
  const signedIn = (roles: string[]) => localStorage.setItem('auth_user', JSON.stringify({ id: 500, name: 'Person', email: 'p@x.co', roles }))
  const bell = () => screen.findByRole('button', { name: /^Notifications/ })

  async function sendAs(audience: RegExp, text: string) {
    renderWithProviders(<App />, { route: '/admin/notifications' })
    const user = userEvent.setup()
    await write(user, text)
    await user.click(screen.getByRole('radio', { name: audience }))
    await user.click(screen.getByRole('button', { name: 'Send announcement' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Send' }))
    await screen.findByText(/^Sent to /)
  }

  it('reaches students, mentors and lecturers it was meant for, and no one else', async () => {
    await sendAs(/^Students/, 'Students only')
    localStorage.removeItem('auth_user')
    for (const [roles, sees] of [
      [['student'], true],
      [['mentor'], false],
      [['lecturer'], false],
    ] as const) {
      signedIn([...roles])
      const view = renderWithProviders(<App />, { route: '/dashboard' })
      const user = userEvent.setup()
      await user.click(await bell())
      const modal = within(await dialog())
      if (sees) expect(await modal.findByText('Students only')).toBeInTheDocument()
      else expect(modal.queryByText('Students only')).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('staff, who get no other notifications, still get announcements', async () => {
    await sendAs(/^Everyone/, 'Welcome to the new week')
    localStorage.removeItem('auth_user')
    signedIn(['mentor', 'lecturer'])
    renderWithProviders(<App />, { route: '/dashboard' })
    const user = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument()
    await user.click(await bell())
    expect(await within(await dialog()).findByText('Welcome to the new week')).toBeInTheDocument()
  })

  it('reading one is remembered for that person only', async () => {
    await sendAs(/^Everyone/, 'Read me once')
    localStorage.removeItem('auth_user')
    signedIn(['lecturer'])
    const first = renderWithProviders(<App />, { route: '/dashboard' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    await user.click(within(await dialog()).getByRole('button', { name: /Mark all as read/ }))
    first.unmount()

    // the same person again: nothing unread
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await bell()).toHaveAccessibleName('Notifications')
    cleanup()

    // someone else (another account) has not read it yet
    localStorage.setItem('auth_user', JSON.stringify({ id: 501, name: 'Other', email: 'o@x.co', roles: ['lecturer'] }))
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument()
  })
})
