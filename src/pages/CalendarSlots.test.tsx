import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { listSlots, reserve } from '../mocks/slots'
import { renderWithProviders } from '../test/renderWithProviders'

// "Today" is Wed 4 Nov 2026. The demo data opens Thu 5 Nov 15:00-18:00 (15:00 is taken by a teammate).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

const STUDENT = { id: 1, name: 'Sam', email: 'sam@example.com', roles: ['student'] }
const MENTOR = { id: 900, name: 'Rashad Aliyev', email: 'rashad@example.com', roles: ['mentor', 'lecturer'] }

async function open(who: typeof STUDENT | typeof MENTOR, dayLabel: RegExp) {
  localStorage.setItem('auth_user', JSON.stringify(who))
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/calendar' })
  const grid = await screen.findByRole('group', { name: 'Month view' })
  await user.click(within(grid).getByRole('button', { name: dayLabel }))
  return { user, dialog: screen.getByRole('region', { name: 'Day details' }) }
}

/** The mentor's "add" part of the panel: pick 1:1 times, which opens the form. */
const openForm = (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) =>
  user.click(within(dialog).getByRole('button', { name: 'Add 1:1 times' }))

const times = (dialog: HTMLElement) => within(within(dialog).getByRole('list', { name: '1:1 times' })).getAllByRole('listitem')

describe('Student: booking a 1:1', () => {
  it('shows the mentor times of that day, split into 30 minutes', async () => {
    const { dialog } = await open(STUDENT, /^Thursday, November 5/)
    expect(within(dialog).getByRole('heading', { name: '1:1 with Rashad Aliyev' })).toBeInTheDocument()
    const rows = times(dialog)
    expect(rows.map((r) => r.querySelector('.slots__time-label')?.textContent)).toEqual([
      '15:00 - 15:30',
      '15:30 - 16:00',
      '16:00 - 16:30',
      '16:30 - 17:00',
      '17:00 - 17:30',
      '17:30 - 18:00',
    ])
    // the time a teammate took is shown as taken, without saying who
    expect(rows[0]).toHaveTextContent('Taken')
    expect(rows[0]).not.toHaveTextContent('Leyla')
    expect(within(rows[0]).queryByRole('button')).not.toBeInTheDocument()
    for (const r of rows.slice(1)) expect(within(r).getByRole('button', { name: /^Book / })).toBeEnabled()
  })

  it('locks the chosen time for the student and says so', async () => {
    const { user, dialog } = await open(STUDENT, /^Thursday, November 5/)
    await user.click(within(dialog).getByRole('button', { name: 'Book 15:30 - 16:00' }))

    expect(await within(dialog).findByRole('status')).toHaveTextContent('Booked 15:30 - 16:00')
    const row = times(dialog)[1]
    expect(row).toHaveTextContent('Booked by you')
    expect(row).toHaveClass('is-mine')
    expect(within(dialog).getByText(/You have a 1:1 on/)).toBeInTheDocument()
    expect(listSlots(STUDENT as never).find((s) => s.bookedBy?.id === 1)).toBeDefined() // saved
  })

  it('allows one 1:1 at a time: the other free times are disabled until it is cancelled', async () => {
    const { user, dialog } = await open(STUDENT, /^Thursday, November 5/)
    await user.click(within(dialog).getByRole('button', { name: 'Book 15:30 - 16:00' }))
    await within(dialog).findByText(/You have a 1:1 on/)
    expect(within(dialog).getByRole('button', { name: 'Book 16:00 - 16:30' })).toBeDisabled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel 15:30 - 16:00' }))
    expect(await within(dialog).findByText('Pick a time to lock it for you.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Book 16:00 - 16:30' })).toBeEnabled()
  })

  it('shows the booking on the calendar and in the day box', async () => {
    const { user, dialog } = await open(STUDENT, /^Thursday, November 5/)
    await user.click(within(dialog).getByRole('button', { name: 'Book 16:00 - 16:30' }))
    await within(dialog).findByText(/You have a 1:1 on/)
    await user.keyboard('{Escape}')

    const cell = within(screen.getByRole('group', { name: 'Month view' })).getByRole('button', { name: /^Thursday, November 5/ })
    expect(cell).toHaveTextContent('1:1 with Rashad Aliyev')
    expect(cell).toHaveTextContent('16:00')
    expect(cell).toHaveTextContent('free 1:1 times') // the rest of the day is still open
  })

  it('says so, and refreshes, when someone else took the time first', async () => {
    const { user, dialog } = await open(STUDENT, /^Thursday, November 5/)
    reserve({ id: 2, name: 'Eli', roles: ['student'] }, listSlots(STUDENT as never)[1].id) // Eli is faster
    await user.click(within(dialog).getByRole('button', { name: 'Book 15:30 - 16:00' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('someone just took this time')
    await waitFor(() => expect(times(dialog)[1]).toHaveTextContent('Taken'))
    expect(within(times(dialog)[1]).queryByRole('button')).not.toBeInTheDocument()
  })

  it('has no booking panel on a day without 1:1 times', async () => {
    const { dialog } = await open(STUDENT, /^Saturday, November 7/)
    expect(within(dialog).queryByRole('heading', { name: /1:1/ })).not.toBeInTheDocument()
    expect(within(dialog).getByText('No events on this day.')).toBeInTheDocument()
  })

  it('never offers the form to add times', async () => {
    const { dialog } = await open(STUDENT, /^Thursday, November 5/)
    expect(within(dialog).queryByLabelText('From')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Add availability' })).not.toBeInTheDocument()
  })

  it('shows the open times of the day in the date box', async () => {
    localStorage.setItem('auth_user', JSON.stringify(STUDENT))
    renderWithProviders(<App />, { route: '/calendar' })
    const grid = await screen.findByRole('group', { name: 'Month view' })
    expect(await within(grid).findByText('5 free 1:1 times')).toBeInTheDocument()
  })
})

describe('Mentor: setting availability', () => {
  it('shows the form with a preview of the 30-minute slots', async () => {
    const { user, dialog } = await open(MENTOR, /^Friday, November 6/)
    expect(within(dialog).queryByLabelText('From')).not.toBeInTheDocument() // closed until asked for
    await openForm(user, dialog)
    expect(within(dialog).getByRole('heading', { name: 'Add 1:1 times' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('From')).toHaveValue('15:00')
    expect(within(dialog).getByLabelText('To')).toHaveValue('18:00')
    expect(within(dialog).getByText('6 times: 15:00 - 15:30 ... 17:30 - 18:00')).toBeInTheDocument()
    expect(within(dialog).queryByRole('list', { name: '1:1 times' })).not.toBeInTheDocument() // none yet
  })

  it('cuts 15:00-18:00 into six free times and keeps them', async () => {
    const { user, dialog } = await open(MENTOR, /^Friday, November 6/)
    await openForm(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Add availability' }))

    expect(await within(dialog).findByText('Added 6 times.')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('From')).not.toBeInTheDocument() // the form closes
    const rows = times(dialog)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('15:00 - 15:30')
    expect(rows[5]).toHaveTextContent('17:30 - 18:00')
    for (const r of rows) expect(r).toHaveTextContent('Free')

    // a student now sees them
    const friday = listSlots({ id: 1, name: 'Sam', roles: ['student'] }).filter((s) => new Date(s.startsAt).getDate() === 6)
    expect(friday).toHaveLength(6)
  })

  it('follows the times that were typed', async () => {
    const { user, dialog } = await open(MENTOR, /^Friday, November 6/)
    await openForm(user, dialog)
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '10:00' } })
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '11:00' } })
    expect(within(dialog).getByText('2 times: 10:00 - 10:30, 10:30 - 11:00')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add availability' }))
    expect(await within(dialog).findByText('Added 2 times.')).toBeInTheDocument()
  })

  it('explains a window that cannot work and disables the button', async () => {
    const { user, dialog } = await open(MENTOR, /^Friday, November 6/)
    await openForm(user, dialog)
    const add = within(dialog).getByRole('button', { name: 'Add availability' })

    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '14:00' } })
    expect(within(dialog).getByText('The end time must be after the start time.')).toBeInTheDocument()
    expect(add).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '15:20' } })
    expect(within(dialog).getByText('The window must be at least 30 minutes long.')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '16:00' } })
    expect(add).toBeEnabled()
  })

  it('does not accept a day that has already passed', async () => {
    const { user, dialog } = await open(MENTOR, /^Tuesday, November 3/)
    await openForm(user, dialog)
    expect(within(dialog).getByText(/already passed/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add availability' })).toBeDisabled()
  })

  it('adding the same window twice does not duplicate the times', async () => {
    const { user, dialog } = await open(MENTOR, /^Friday, November 6/)
    await openForm(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Add availability' }))
    await within(dialog).findByText('Added 6 times.')
    await openForm(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Add availability' }))
    expect(await within(dialog).findByText('Those times were already in your list.')).toBeInTheDocument()
    expect(times(dialog)).toHaveLength(6)
  })

  it('shows who booked each time, and lets the mentor remove a free time', async () => {
    const { user, dialog } = await open(MENTOR, /^Thursday, November 5/)
    const rows = times(dialog)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('Leyla Hasanova')
    expect(rows[1]).toHaveTextContent('Free')

    await user.click(within(dialog).getByRole('button', { name: 'Remove 17:30 - 18:00' }))
    expect(await within(dialog).findByText('Time removed.')).toBeInTheDocument()
    expect(times(dialog)).toHaveLength(5)
  })

  it('can cancel a student booking, which frees the time again', async () => {
    const { user, dialog } = await open(MENTOR, /^Thursday, November 5/)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking 15:00 - 15:30' }))
    expect(await within(dialog).findByText(/Booking cancelled/)).toBeInTheDocument()
    expect(times(dialog)[0]).toHaveTextContent('Free')
  })

  it('shows the booked 1:1s on the mentor calendar', async () => {
    localStorage.setItem('auth_user', JSON.stringify(MENTOR))
    renderWithProviders(<App />, { route: '/calendar' })
    const grid = await screen.findByRole('group', { name: 'Month view' })
    const cell = await within(grid).findByRole('button', { name: /^Thursday, November 5/ })
    await waitFor(() => expect(cell).toHaveTextContent('1:1 with Leyla Hasanova'))
    expect(cell).toHaveTextContent('1:1 times: 5 of 6 free')
  })
})
