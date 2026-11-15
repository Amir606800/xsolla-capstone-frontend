import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ALL, FilterChips, FilterMenu } from './FilterMenu'
import type { FilterGroup } from './FilterMenu'

const GROUPS = (week: string, mentor: string): FilterGroup[] => [
  {
    id: 'week',
    label: 'Week',
    value: week,
    options: [
      { value: ALL, label: 'All weeks' },
      { value: 'm5', label: 'Week 5 · React' },
      { value: 'm4', label: 'Week 4 · Git' },
    ],
  },
  {
    id: 'mentor',
    label: 'Mentor',
    value: mentor,
    options: [
      { value: ALL, label: 'All mentors' },
      { value: '900', label: 'Rashad' },
    ],
  },
]

function Harness() {
  const [week, setWeek] = useState(ALL)
  const [mentor, setMentor] = useState(ALL)
  const groups = GROUPS(week, mentor)
  const change = (id: string, value: string) => (id === 'week' ? setWeek(value) : setMentor(value))
  return (
    <>
      <FilterMenu
        groups={groups}
        onChange={change}
        onClear={() => {
          setWeek(ALL)
          setMentor(ALL)
        }}
      />
      <FilterChips groups={groups} onChange={change} />
      <button type="button">Elsewhere</button>
    </>
  )
}

const filtersButton = () => screen.getByRole('button', { name: /^Filters/ })

describe('FilterMenu: a Filters button with a panel of options', () => {
  it('is closed at first; the button opens it and shows every list', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(filtersButton()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('group', { name: 'Filters' })).toBeNull()
    await user.click(filtersButton())
    const panel = within(screen.getByRole('group', { name: 'Filters' }))
    expect(filtersButton()).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel.getByRole('group', { name: 'Week' })).getAllByRole('radio')).toHaveLength(3)
    expect(within(panel.getByRole('group', { name: 'Mentor' })).getAllByRole('radio')).toHaveLength(2)
    // "no filter" is chosen in each list to begin with
    expect(panel.getByRole('radio', { name: 'All weeks' })).toBeChecked()
  })

  it('a choice applies at once and the panel stays open, so several can be set; the button counts them', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(within(filtersButton()).queryByLabelText(/on$/)).toBeNull()
    await user.click(filtersButton())
    await user.click(screen.getByRole('radio', { name: 'Week 4 · Git' }))
    expect(screen.getByRole('group', { name: 'Filters' })).toBeInTheDocument()
    expect(within(filtersButton()).getByLabelText('1 on')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Rashad' }))
    expect(within(filtersButton()).getByLabelText('2 on')).toBeInTheDocument()
  })

  it('closes with Escape (focus goes back to the button), with a click outside, and with Done', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(filtersButton())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Filters' })).toBeNull()
    expect(filtersButton()).toHaveFocus()

    await user.click(filtersButton())
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.queryByRole('group', { name: 'Filters' })).toBeNull()

    await user.click(filtersButton())
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('group', { name: 'Filters' })).toBeNull()
  })

  it('the keyboard works: arrow keys move through an option list', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(filtersButton())
    screen.getByRole('radio', { name: 'All weeks' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Week 5 · React' })).toBeChecked()
  })

  it('"Clear filters" is off while nothing is filtered, and puts everything back when something is', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(filtersButton())
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Week 5 · React' }))
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('radio', { name: 'All weeks' })).toBeChecked()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
  })
})

describe('FilterChips: what is filtered, one chip each', () => {
  it('shows nothing when nothing is filtered, a chip per filter otherwise, and a click removes that filter', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    await user.click(filtersButton())
    await user.click(screen.getByRole('radio', { name: 'Week 4 · Git' }))
    await user.click(screen.getByRole('radio', { name: 'Rashad' }))
    const chips = within(screen.getByRole('list', { name: 'Active filters' }))
    expect(chips.getAllByRole('listitem')).toHaveLength(2)
    expect(chips.getByText('Week 4 · Git')).toBeInTheDocument()
    await user.click(chips.getByRole('button', { name: 'Remove the week filter: Week 4 · Git' }))
    expect(within(screen.getByRole('list', { name: 'Active filters' })).getAllByRole('listitem')).toHaveLength(1)
    // (the click on a chip was outside the panel, so it closed)
    await user.click(filtersButton())
    expect(screen.getByRole('radio', { name: 'All weeks' })).toBeChecked()
  })
})
