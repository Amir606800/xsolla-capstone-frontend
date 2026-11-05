import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchModules } from '../api/courses'
import { fetchStandings } from '../api/standings'
import { CoursesProvider } from '../context/CoursesProvider'
import { StandingsProvider } from '../context/StandingsProvider'
import { renderWithProviders } from '../test/renderWithProviders'
import type { WeeklyStanding } from '../types/standing'
import GradesPage from './GradesPage'

function renderGrades(role: 'student' | 'teacher' = 'student') {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role }))
  return renderWithProviders(
    <CoursesProvider>
      <StandingsProvider>
        <GradesPage />
      </StandingsProvider>
    </CoursesProvider>,
  )
}

const ready = () => screen.findByRole('heading', { name: 'Week by week' })
const weekly = () => within(screen.getByRole('list', { name: 'Weekly ratings' })).getAllByRole('listitem')

/** Ratings for consecutive weeks from week 1. */
const ratings = (...levels: WeeklyStanding['level'][]): WeeklyStanding[] =>
  levels.map((level, i) => ({ week: i + 1, level, assessedAt: '2026-03-01T18:00:00Z' }))

describe('GradesPage: loading', () => {
  it('shows a loading state, then the page', async () => {
    renderGrades()
    expect(screen.getByRole('heading', { name: 'My grades', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    await ready()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an error with retry when the standings cannot be loaded, and recovers', async () => {
    vi.mocked(fetchStandings).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderGrades()
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load")
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await ready()
  })

  it('shows an error when the courses cannot be loaded, and recovers', async () => {
    vi.mocked(fetchModules).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderGrades()
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load")
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await ready()
  })
})

describe('GradesPage: the weekly standing', () => {
  it('shows where the student stands now, in the program words', async () => {
    renderGrades() // mock: green, red, green, yellow, yellow
    await ready()
    expect(screen.getByRole('img', { name: 'Current standing: Falling behind' })).toBeInTheDocument()
    const summary = within(screen.getByRole('region', { name: 'Current standing' }))
    expect(summary.getByText(/falling behind but putting in effort to catch up/)).toBeInTheDocument()
  })

  it('has no points or percentages anywhere', async () => {
    renderGrades()
    await ready()
    expect(screen.queryByText(/\d+\s*\/\s*\d+/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+\s*%/)).not.toBeInTheDocument()
  })

  it('shows one square per week, coloured by the mentor rating, grey when not rated', async () => {
    renderGrades()
    await ready()
    const tiles = within(screen.getByRole('list', { name: 'Weekly standing' })).getAllByRole('listitem')
    expect(tiles).toHaveLength(12)
    expect(tiles[0]).toHaveAccessibleName('Week 1: On track')
    expect(tiles[1]).toHaveAccessibleName('Week 2: No progress')
    expect(tiles[3]).toHaveAccessibleName('Week 4: Falling behind')
    expect(tiles[5]).toHaveAccessibleName('Week 6: not rated yet')
    expect(tiles[0]).toHaveClass('week-tile--green')
    expect(tiles[1]).toHaveClass('week-tile--red')
    expect(tiles[3]).toHaveClass('week-tile--yellow')
    expect(tiles[11]).toHaveClass('week-tile--none')
  })

  it('lists the rated weeks, newest first, with the module and the mentor note', async () => {
    renderGrades()
    await ready()
    const rows = weekly()
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('Week 5 · React')
    expect(rows[4]).toHaveTextContent('Week 1 · Onboarding & Git')
    expect(rows[4]).toHaveTextContent('Great start')
    expect(within(rows[1]).getByText('Falling behind')).toBeInTheDocument()
  })

  it('splits the weeks by level', async () => {
    renderGrades()
    await ready()
    const legend = screen.getByRole('list', { name: 'Weeks by level' })
    expect(legend).toHaveTextContent('2 On track')
    expect(legend).toHaveTextContent('2 Falling behind')
    expect(legend).toHaveTextContent('1 No progress')
  })

  it('warns about the run of yellow weeks', async () => {
    renderGrades()
    await ready()
    expect(screen.getByRole('alert')).toHaveTextContent('2 yellow weeks in a row. At 4 in a row it counts as red.')
  })

  it('explains the rules', async () => {
    renderGrades()
    await ready()
    const rules = screen.getByRole('heading', { name: 'How it works' }).closest('section')!
    expect(rules).toHaveTextContent('4 falling behind weeks (yellow) in a row count as red')
    expect(rules).toHaveTextContent('2 red weeks in a row mean removal from the program')
    expect(rules).toHaveTextContent('On track')
    expect(rules).toHaveTextContent('No progress')
  })
})

describe('GradesPage: the rules applied to the ratings', () => {
  it('flags a fourth yellow week as red', async () => {
    vi.mocked(fetchStandings).mockResolvedValueOnce(ratings('yellow', 'yellow', 'yellow', 'yellow'))
    renderGrades()
    await ready()
    expect(screen.getByRole('img', { name: 'Current standing: No progress' })).toBeInTheDocument()
    expect(screen.getByText(/4 yellow weeks in a row, so this week counts as red/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/One more red week in a row means removal/)
  })

  it('shows the removal warning after two red weeks in a row', async () => {
    vi.mocked(fetchStandings).mockResolvedValueOnce(ratings('green', 'red', 'red'))
    renderGrades()
    await ready()
    expect(screen.getByRole('alert')).toHaveTextContent(/2 red weeks in a row mean removal from the program/)
    expect(screen.getByRole('alert')).toHaveTextContent(/talk to your mentor/)
  })

  it('has no warning when the student is on track', async () => {
    vi.mocked(fetchStandings).mockResolvedValueOnce(ratings('green', 'green'))
    renderGrades()
    await ready()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Current standing: On track' })).toBeInTheDocument()
  })

  it('says so when nothing has been rated yet', async () => {
    vi.mocked(fetchStandings).mockResolvedValueOnce([])
    renderGrades()
    await ready()
    expect(screen.getByRole('img', { name: 'Current standing: not rated yet' })).toBeInTheDocument()
    expect(screen.getByText('No week has been rated yet.')).toBeInTheDocument()
    expect(screen.getByText(/Nothing has been rated yet/)).toBeInTheDocument()
  })
})

describe('GradesPage: feedback on tasks', () => {
  it('lists the graded tasks with the lecturer feedback, linked to their module', async () => {
    renderGrades()
    await ready()
    const list = screen.getByRole('list', { name: 'Graded tasks' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(within(row).getByText('Graded')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^\/courses\/m\d+$/))
    expect(list).toHaveTextContent(/“.+”/)
  })

  it('points to the work that is waiting to be graded', async () => {
    renderGrades()
    await ready()
    expect(screen.getByRole('link', { name: /waiting to be graded/ })).toHaveAttribute('href', '/tasks?status=submitted')
  })

  it('never shows tasks of modules that are not open yet (students)', async () => {
    renderGrades()
    await ready()
    expect(screen.queryByText(/Schema design|Docker/)).not.toBeInTheDocument()
  })
})
