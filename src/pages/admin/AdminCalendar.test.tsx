import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as eventsApi from '../../api/events'
import App from '../../App'
import { listEvents } from '../../mocks/contentEdits'
import { eventsBetween, eventsIn, nextDays, rangeLabel, startInputs, weekRange } from '../../utils/adminCalendar'
import { dateKey, formatEventTime, fullDateLabel, monthLabel } from '../../utils/calendar'
import type { CalendarEvent } from '../../types/calendar'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const thisMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
const list = () => screen.findByRole('region', { name: monthLabel(thisMonth()) })
const dialog = () => screen.findByRole('dialog')
/** A weekly lecture inside this month (the demo has one every Monday, so there always is one). */
const aLecture = () => eventsIn(listEvents(), thisMonth()).find((e) => e.kind === 'lecture')!
const when = (e: CalendarEvent) => `${fullDateLabel(new Date(e.startsAt))}, ${formatEventTime(e)}`
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('Admin calendar', () => {
  it('shows the month and, beside it, this month’s lectures, meetings and off-campus days', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    expect(await screen.findByRole('heading', { name: 'Calendar', level: 1 })).toBeInTheDocument()
    const region = await list()
    expect(screen.getByRole('group', { name: 'Month view' })).toBeInTheDocument()
    const expected = eventsIn(listEvents(), thisMonth())
    expect(within(region).getAllByRole('button', { name: /^Delete / })).toHaveLength(expected.length)
    expect(within(within(region).getByRole('group', { name: 'Show' })).getByRole('button', { name: /^All/ })).toHaveTextContent(String(expected.length))
  })

  it('leaves out task deadlines and 1:1 times', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const region = await list()
    // demo task names and 1:1 slots never show up here
    expect(within(region).queryByText(/Git workflow|CLI tool|HTTP server|1:1/)).not.toBeInTheDocument()
  })

  it('filters by type', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const region = await list()
    await userEvent.setup().click(within(region).getByRole('button', { name: /^Lectures/ }))
    for (const meta of region.querySelectorAll('.admin-cal__meta')) expect(meta).toHaveTextContent(/^Lecture ·/)
  })

  it('picking a day shows only that day; picking it again (or the link) shows the month', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    await list()
    const lecture = aLecture()
    const key = dateKey(new Date(lecture.startsAt))
    const cell = screen.getByRole('button', { name: new RegExp(`^${escape(fullDateLabel(new Date(lecture.startsAt)))}, `) })
    await user.click(cell)
    expect(cell).toHaveAttribute('aria-pressed', 'true')
    const dayRegion = screen.getByRole('button', { name: /^Show all of / }).closest('section')!
    expect(within(dayRegion).getAllByRole('button', { name: /^Delete / }).length).toBe(eventsIn(listEvents(), thisMonth(), key).length)
    await user.click(screen.getByRole('button', { name: /^Show all of / }))
    expect(await list()).toBeInTheDocument()
  })

  it('quick ranges: this week and the next 7 days', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    await list()
    const range = within(screen.getByRole('group', { name: 'Time range' }))
    await user.click(range.getByRole('button', { name: 'This week' }))
    const week = weekRange(new Date())
    let region = screen.getByRole('region', { name: rangeLabel(week) })
    expect(range.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(region).queryAllByRole('button', { name: /^Delete / })).toHaveLength(eventsBetween(listEvents(), week).length)
    expect(range.getByLabelText('From')).toHaveValue(week.from)
    expect(range.getByLabelText('To')).toHaveValue(week.to)

    await user.click(range.getByRole('button', { name: 'Next 7 days' }))
    const next = nextDays(new Date(), 7)
    region = screen.getByRole('region', { name: rangeLabel(next) })
    expect(within(region).queryAllByRole('button', { name: /^Delete / })).toHaveLength(eventsBetween(listEvents(), next).length)

    await user.click(range.getByRole('button', { name: 'Whole month' }))
    expect(await list()).toBeInTheDocument()
  })

  it('a custom range from the From and To fields; its days are tinted on the month', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    await list()
    const range = within(screen.getByRole('group', { name: 'Time range' }))
    const m = thisMonth()
    const from = dateKey(new Date(m.getFullYear(), m.getMonth(), 3))
    const to = dateKey(new Date(m.getFullYear(), m.getMonth(), 16))
    fireEvent.change(range.getByLabelText('From'), { target: { value: from } })
    fireEvent.change(range.getByLabelText('To'), { target: { value: to } })
    const region = screen.getByRole('region', { name: rangeLabel({ from, to }) })
    expect(within(region).queryAllByRole('button', { name: /^Delete / })).toHaveLength(eventsBetween(listEvents(), { from, to }).length)
    expect(document.querySelectorAll('.cell.is-in-range')).toHaveLength(14)
    // a From after the To swaps them round instead of showing nothing
    const late = dateKey(new Date(m.getFullYear(), m.getMonth(), 20))
    fireEvent.change(range.getByLabelText('From'), { target: { value: late } })
    expect(screen.getByRole('region', { name: rangeLabel({ from: to, to: late }) })).toBeInTheDocument()
  })

  it('Shift+click stretches the picked day into a range', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    await list()
    const m = thisMonth()
    const day = (d: number) => new Date(m.getFullYear(), m.getMonth(), d)
    const cell = (d: number) => screen.getByRole('button', { name: new RegExp(`^${escape(fullDateLabel(day(d)))}(,|$)`) })
    await user.click(cell(5))
    await user.keyboard('{Shift>}')
    await user.click(cell(11))
    await user.keyboard('{/Shift}')
    expect(screen.getByRole('region', { name: rangeLabel({ from: dateKey(day(5)), to: dateKey(day(11)) }) })).toBeInTheDocument()
    expect(document.querySelectorAll('.cell.is-in-range')).toHaveLength(7)
  })

  it('past events are shaded and marked as past in the list', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    await list()
    // last week is always over, and has the weekly lecture
    const lastWeek = weekRange(new Date(Date.now() - 7 * 86_400_000))
    const range = within(screen.getByRole('group', { name: 'Time range' }))
    fireEvent.change(range.getByLabelText('From'), { target: { value: lastWeek.from } })
    fireEvent.change(range.getByLabelText('To'), { target: { value: lastWeek.to } })
    const region = screen.getByRole('region', { name: rangeLabel(lastWeek) })
    const items = region.querySelectorAll('.admin-cal__event')
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item).toHaveClass('is-past')
      expect(item).toHaveTextContent('Past')
    }
  })

  it('pages through the months', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    await list()
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    const next = new Date(thisMonth().getFullYear(), thisMonth().getMonth() + 1, 1)
    expect(screen.getByRole('region', { name: monthLabel(next) })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(await list()).toBeInTheDocument()
  })

  it('adds an event with the lecturer’s form', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    await list()
    await user.click(screen.getByRole('button', { name: 'New event' }))
    const form = within(await dialog())
    await user.type(form.getByLabelText('Title'), 'Guest talk')
    await user.selectOptions(form.getByLabelText('Type'), 'Meeting')
    await user.click(form.getByRole('button', { name: 'Add event' }))
    expect(await screen.findByText('Event added.')).toBeInTheDocument()
    expect(screen.getAllByText('Guest talk').length).toBeGreaterThan(0)
    expect(listEvents().some((e) => e.title === 'Guest talk' && e.kind === 'meeting')).toBe(true)
  })

  it('keeps an add button beside the list while events are shown, so the next one can be added', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    const region = await list()
    await user.click(within(region).getByRole('button', { name: /^Add an event/ }))
    const form = within(await dialog())
    await user.type(form.getByLabelText('Title'), 'Another talk')
    await user.click(form.getByRole('button', { name: 'Add event' }))
    expect(await screen.findByText('Event added.')).toBeInTheDocument()
    expect(within(await list()).getByRole('button', { name: /^Add an event/ })).toBeEnabled()
  })

  it('edits an event', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    const region = await list()
    await user.click(within(region).getAllByRole('button', { name: /^Edit / })[0])
    const form = within(await dialog())
    expect(form.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument()
    await user.clear(form.getByLabelText('Title'))
    await user.type(form.getByLabelText('Title'), 'Renamed event')
    await user.click(form.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('Event saved.')).toBeInTheDocument()
    expect(listEvents().some((e) => e.title === 'Renamed event')).toBe(true)
  })

  it('postpones an event by a week and keeps its length', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    await list()
    const lecture = aLecture()
    await user.click(screen.getByRole('button', { name: `Postpone Lecture on ${when(lecture)}` }))
    const form = within(await dialog())
    expect(form.getByText(/^Now:/)).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: '+1 week' }))
    expect(form.getByText(/^Moves to:/)).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Postpone' }))
    expect(await screen.findByText(/^“Lecture” moved to /)).toBeInTheDocument()
    const moved = listEvents().find((e) => e.id === lecture.id)!
    const week = 7 * 86_400_000
    expect(new Date(moved.startsAt).getTime() - new Date(lecture.startsAt).getTime()).toBeGreaterThanOrEqual(week - 3_600_000)
    expect(new Date(moved.endsAt).getTime() - new Date(moved.startsAt).getTime()).toBe(2 * 3_600_000)
  })

  it('postpone needs a different day or time', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    await list()
    const lecture = aLecture()
    await user.click(screen.getByRole('button', { name: `Postpone Lecture on ${when(lecture)}` }))
    const form = within(await dialog())
    // it starts one day later, so it can be saved straight away
    expect(form.getByRole('button', { name: 'Postpone' })).toBeEnabled()
    // set back to the time it has now: nothing to save
    const original = startInputs(lecture)
    fireEvent.change(form.getByLabelText('New day'), { target: { value: original.date } })
    fireEvent.change(form.getByLabelText('Starts at'), { target: { value: original.time } })
    expect(form.getByText('That is when it is now. Pick another day or time.')).toBeInTheDocument()
    expect(form.getByRole('button', { name: 'Postpone' })).toBeDisabled()
  })

  it('deletes an event after confirming', async () => {
    renderWithProviders(<App />, { route: '/admin/calendar' })
    const user = userEvent.setup()
    const region = await list()
    const before = within(region).getAllByRole('button', { name: /^Delete / }).length
    await user.click(within(region).getAllByRole('button', { name: /^Delete / })[0])
    const confirm = within(await dialog())
    expect(confirm.getByText(/It is removed from everyone’s calendar\./)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Delete event' }))
    await waitFor(() => expect(within(region).getAllByRole('button', { name: /^Delete / }).length).toBe(before - 1))
    expect(screen.getByText(/” deleted\.$/)).toBeInTheDocument()
  })

  it('says so when the calendar cannot be loaded, and can try again', async () => {
    vi.mocked(eventsApi.fetchEvents).mockRejectedValueOnce(new Error('offline'))
    renderWithProviders(<App />, { route: '/admin/calendar' })
    expect(await screen.findByText('The calendar could not be loaded.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await list()).toBeInTheDocument()
  })
})
