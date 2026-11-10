import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { listEvents } from '../mocks/contentEdits'
import { renderWithProviders } from '../test/renderWithProviders'
import { fullDateLabel } from '../utils/calendar'

/** Last week's lecture is always over (the demo has one every Monday). */
const pastLecture = () => listEvents().find((e) => e.id === 'lec--1')!

describe('Past events on the LMS calendar', () => {
  it.each([[['student']], [['mentor', 'lecturer']], [['lecturer']]])('are shaded and labelled "Past" for %j', async (roles) => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@x', roles }))
    renderWithProviders(<App />, { route: '/calendar' })
    const user = userEvent.setup()
    const date = new Date(pastLecture().startsAt)
    await screen.findByRole('group', { name: 'Month view' })
    // the lecture may be in last month: page back if needed
    if (date.getMonth() !== new Date().getMonth()) await user.click(screen.getByRole('button', { name: 'Previous month' }))
    const cell = screen.getByRole('button', { name: new RegExp(`^${fullDateLabel(date)}, `) })
    expect(cell.querySelector('.ev--lecture')).toHaveClass('is-past')
    await user.click(cell)
    const card = within(await screen.findByRole('region', { name: 'Day details' })).getByRole('heading', { name: 'Lecture' }).closest('li')!
    expect(card).toHaveClass('is-past')
    expect(within(card).getByText('Past')).toBeInTheDocument()
  })

  it('upcoming events keep their full colour', async () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@x', roles: ['student'] }))
    renderWithProviders(<App />, { route: '/calendar' })
    await screen.findByRole('group', { name: 'Month view' })
    const future = listEvents().find((e) => e.id === 'lec-4')! // four weeks ahead
    const date = new Date(future.startsAt)
    if (date.getMonth() !== new Date().getMonth()) await userEvent.setup().click(screen.getByRole('button', { name: 'Next month' }))
    const cell = screen.getByRole('button', { name: new RegExp(`^${fullDateLabel(date)}, `) })
    expect(cell.querySelector('.ev--lecture')).not.toHaveClass('is-past')
  })
})
