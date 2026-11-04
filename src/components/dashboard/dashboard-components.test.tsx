import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { buildMockModules } from '../../mocks/courses'
import { overallStats, recentGrades, upcomingDeadlines } from '../../utils/progress'
import { DeadlinesCard } from './DeadlinesCard'
import { JourneyPath } from './JourneyPath'
import { RecentGradesCard } from './RecentGradesCard'
import { ScoreCard } from './ScoreCard'
import { StatBar } from './StatBar'

const NOW = new Date('2026-11-04T12:00:00Z')
const modules = buildMockModules(NOW)

describe('JourneyPath', () => {
  it('renders one link per module, 4 per row, alternating direction', () => {
    const { container } = render(
      <MemoryRouter>
        <JourneyPath modules={modules} now={NOW} />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(12)

    const rows = container.querySelectorAll('.path__row')
    expect(rows).toHaveLength(3)
    expect(rows[0]).not.toHaveClass('is-reversed')
    expect(rows[1]).toHaveClass('is-reversed')
    expect(rows[2]).not.toHaveClass('is-reversed')
    expect(rows[2]).toHaveClass('is-last')
    rows.forEach((r) => expect(r.querySelectorAll('a')).toHaveLength(4))
  })

  it('links each node to its module and describes it for screen readers', () => {
    render(
      <MemoryRouter>
        <JourneyPath modules={modules} now={NOW} />
      </MemoryRouter>,
    )
    const first = screen.getByRole('link', { name: /Module 1: Onboarding & Git, 100% done, completed/ })
    expect(first).toHaveAttribute('href', '/courses/m1')

    const overdue = screen.getByRole('link', { name: /Module 4: TypeScript.*overdue.*next deadline/ })
    expect(overdue).toHaveClass('node--overdue')
  })

  it('shows a deadline badge only where something is still open, red when urgent', () => {
    render(
      <MemoryRouter>
        <JourneyPath modules={modules} now={NOW} />
      </MemoryRouter>,
    )
    const done = screen.getByRole('link', { name: /Module 1:/ })
    expect(done.querySelector('.node__badge')).toBeNull()

    const overdue = screen.getByRole('link', { name: /Module 4:/ })
    expect(overdue.querySelector('.node__badge')).toHaveClass('is-urgent')

    const future = screen.getByRole('link', { name: /Module 12:/ })
    expect(future.querySelector('.node__badge')).not.toHaveClass('is-urgent')
  })
})

describe('StatBar', () => {
  it('exposes progress semantics', () => {
    render(<StatBar label="Tasks" value={3} max={12} />)
    const bar = screen.getByRole('progressbar', { name: 'Tasks' })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '12')
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 12')
  })

  it('does not divide by zero', () => {
    render(<StatBar label="Empty" value={0} max={0} />)
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' })
  })

  it('renders a reserved placeholder slot', () => {
    render(<StatBar label="Quizzes" value={0} max={0} placeholder="Coming soon" />)
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Quizzes' })).toHaveAttribute('aria-valuetext', 'Coming soon')
  })
})

describe('ScoreCard', () => {
  it('shows the score percent, module/task counts and the quiz slot', () => {
    const stats = overallStats(modules, NOW)
    render(<ScoreCard stats={stats} />)
    expect(screen.getByText(`${stats.scorePercent}%`)).toBeInTheDocument()
    expect(screen.getByText('My score')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Modules' })).toHaveAttribute('aria-valuemax', '12')
    expect(screen.getByRole('progressbar', { name: 'Tasks' })).toHaveAttribute(
      'aria-valuemax',
      String(stats.tasksTotal),
    )
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })
})

describe('DeadlinesCard', () => {
  it('lists entries and marks overdue ones', () => {
    render(<DeadlinesCard entries={upcomingDeadlines(modules, NOW, 5)} now={NOW} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    expect(within(rows[0]).getByText(/overdue/)).toHaveClass('pill--danger')
    expect(within(rows[1]).getByText(/^in /)).not.toHaveClass('pill--danger')
  })

  it('shows an empty state', () => {
    render(<DeadlinesCard entries={[]} now={NOW} />)
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
  })
})

describe('RecentGradesCard', () => {
  it('lists grades with max points and feedback', () => {
    render(<RecentGradesCard entries={recentGrades(modules, 4)} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getAllByText(/\/100$/).length).toBe(4)
    expect(screen.getAllByText(/^“.+”$/).length).toBeGreaterThan(0)
  })

  it('shows an empty state', () => {
    render(<RecentGradesCard entries={[]} />)
    expect(screen.getByText('No graded work yet.')).toBeInTheDocument()
  })
})
