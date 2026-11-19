import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'

// "Today" is Wed 4 Nov 2026. A talk is not a 1:1: it can be on a Thursday and it changes no deadline.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

const STUDENT = {
  id: 1,
  name: 'Sam Student',
  email: 'student@xsolla.school',
  roles: ['student'],
}
const MENTOR = {
  id: 900,
  name: 'Rashad Aliyev',
  email: 'rashad@example.com',
  roles: ['mentor', 'lecturer'],
}

async function open(who: typeof STUDENT | typeof MENTOR, dayLabel: RegExp) {
  localStorage.setItem('auth_user', JSON.stringify(who))
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/calendar' })
  const grid = await screen.findByRole('group', { name: 'Month view' })
  await user.click(within(grid).getByRole('button', { name: dayLabel }))
  return { user, dialog: screen.getByRole('region', { name: 'Day details' }) }
}

describe('Talks with students (not 1:1s)', () => {
  it('a mentor sets one up on any day for the whole team, and cancels it', async () => {
    const { user, dialog } = await open(MENTOR, /^Thursday, November 5/)
    await user.click(within(dialog).getByRole('button', { name: 'Add a discussion with students' }))
    await user.type(within(dialog).getByLabelText('Title'), 'Plan for the demo')
    await user.click(within(dialog).getByRole('button', { name: 'Set up the discussion' }))

    expect(await within(dialog).findByRole('status')).toHaveTextContent('Discussion set up')
    const card = within(dialog).getByRole('heading', { name: 'Plan for the demo' }).closest('li') as HTMLElement
    expect(card).toHaveTextContent('Discussion')
    expect(card).toHaveTextContent('15:00')

    await user.click(within(card).getByRole('button', { name: 'Delete Plan for the demo' }))
    await user.click(within(card).getByRole('button', { name: 'Yes, cancel it' }))
    expect(await within(dialog).findByText('Discussion cancelled.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Plan for the demo' })).not.toBeInTheDocument()
  })

  it('asks for a title and a student before it can be saved', async () => {
    const { user, dialog } = await open(MENTOR, /^Thursday, November 5/)
    await user.click(within(dialog).getByRole('button', { name: 'Add a discussion with students' }))
    expect(within(dialog).getByRole('button', { name: 'Set up the discussion' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Title'), 'Retro')
    await user.click(within(dialog).getByRole('checkbox', { name: 'The whole team' }))
    expect(await within(dialog).findByText('Choose at least one student.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Set up the discussion' })).toBeDisabled()
  })

  it('a student sees the talk they are invited to, cannot cancel it, and their deadline does not move', async () => {
    const mentor = await open(MENTOR, /^Thursday, November 5/)
    await mentor.user.click(
      within(mentor.dialog).getByRole('button', {
        name: 'Add a discussion with students',
      }),
    )
    await mentor.user.type(within(mentor.dialog).getByLabelText('Title'), 'Plan for the demo')
    await mentor.user.click(within(mentor.dialog).getByRole('button', { name: 'Set up the discussion' }))
    await within(mentor.dialog).findByRole('status')
    mentor.user.keyboard('{Escape}')
    document.body.innerHTML = ''

    const { dialog } = await open(STUDENT, /^Thursday, November 5/)
    const card = (await within(dialog).findByRole('heading', { name: 'Plan for the demo' })).closest('li') as HTMLElement
    expect(card).toHaveTextContent('A discussion with Rashad Aliyev')
    expect(within(card).queryByRole('button', { name: /Delete|Edit/ })).not.toBeInTheDocument()
    // still no 1:1: the week's work is due on Monday
    const grid = within(screen.getByRole('group', { name: 'Month view' }))
    expect(grid.getByRole('button', { name: /^Monday, November 9/ })).toHaveTextContent('Due: CLI tool')
  })
})
