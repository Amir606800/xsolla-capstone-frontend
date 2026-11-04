import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { buildMockModules } from '../../mocks/courses'
import type { CourseModule } from '../../types/course'
import { isModuleLocked, overallStats, recentGrades, upcomingDeadlines } from '../../utils/progress'
import { DeadlinesCard } from './DeadlinesCard'
import { JourneyPath } from './JourneyPath'
import { RecentGradesCard } from './RecentGradesCard'
import { ScoreCard } from './ScoreCard'
import { StatBar } from './StatBar'

const NOW = new Date('2026-11-04T12:00:00Z')
const modules = buildMockModules(NOW)

describe('JourneyPath', () => {
  // student view: modules that open in the future are locked
  const studentLock = (m: CourseModule) => isModuleLocked(m, NOW)
  const renderPath = (isLocked: (m: CourseModule) => boolean = studentLock) =>
    render(
      <MemoryRouter>
        <JourneyPath modules={modules} now={NOW} isLocked={isLocked} />
      </MemoryRouter>,
    )

  it('renders every module, 4 per row, alternating direction', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('.node')).toHaveLength(12)

    const rows = container.querySelectorAll('.path__row')
    expect(rows).toHaveLength(3)
    expect(rows[0]).not.toHaveClass('is-reversed')
    expect(rows[1]).toHaveClass('is-reversed')
    expect(rows[2]).not.toHaveClass('is-reversed')
    expect(rows[2]).toHaveClass('is-last')
    rows.forEach((r) => expect(r.querySelectorAll('.node')).toHaveLength(4))
  })

  it('links only the modules that are open', () => {
    renderPath()
    expect(screen.getAllByRole('link')).toHaveLength(6) // modules 1-6 are open
    expect(screen.getAllByRole('group', { name: /^Module \d+:.*locked/ })).toHaveLength(6)
  })

  it('links each open node to its module and describes it for screen readers', () => {
    renderPath()
    const first = screen.getByRole('link', { name: /Module 1: Onboarding & Git, 100% done, completed/ })
    expect(first).toHaveAttribute('href', '/courses/m1')

    const overdue = screen.getByRole('link', { name: /Module 4: TypeScript.*overdue.*next deadline/ })
    expect(overdue).toHaveClass('node--overdue')
  })

  it('locked modules are not links, say when they open, and reveal no tasks', () => {
    renderPath()
    const locked = screen.getByRole('group', { name: /^Module 7: Databases & SQL, locked, opens / })
    expect(locked).toHaveClass('node--locked')
    expect(locked).toHaveTextContent(/Opens [A-Z][a-z]{2} \d+/)
    expect(locked.querySelector('.node__badge')).toBeNull() // no deadline leaks
    expect(screen.queryByRole('link', { name: /Module 7:/ })).not.toBeInTheDocument()
  })

  it('shows a deadline badge only on open modules with work left, red when urgent', () => {
    renderPath()
    const done = screen.getByRole('link', { name: /Module 1:/ })
    expect(done.querySelector('.node__badge')).toBeNull()

    const overdue = screen.getByRole('link', { name: /Module 4:/ })
    expect(overdue.querySelector('.node__badge')).toHaveClass('is-urgent')
    expect(overdue).not.toHaveClass('node--active') // an old module is not "current"
  })

  it('opens everything for viewers who are not locked out (teachers/admins)', () => {
    renderPath(() => false)
    expect(screen.getAllByRole('link')).toHaveLength(12)
    expect(screen.queryByRole('group', { name: /locked/ })).not.toBeInTheDocument()
  })
})

describe('JourneyPath - current (active) module', () => {
  const studentLock = (m: CourseModule) => isModuleLocked(m, NOW)
  const renderPath = () =>
    render(
      <MemoryRouter>
        <JourneyPath modules={modules} now={NOW} isLocked={studentLock} />
      </MemoryRouter>,
    )
  const current = () => screen.getByRole('link', { name: /Module 6:/ })

  it('marks exactly one module as the current step', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('.node--active')).toHaveLength(1)
    expect(current()).toHaveClass('node--active')
    expect(current()).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('link', { name: /Module 5:/ })).not.toHaveAttribute('aria-current')
  })

  it('shows an "Opened" badge on the left and a "Due" badge with the exact time on the right', () => {
    renderPath()
    const left = current().querySelector('.node__tag--left')!
    expect(left).toHaveTextContent('Opened')
    expect(left).toHaveTextContent(/[A-Z][a-z]{2} \d+/)

    const right = current().querySelector('.node__tag--right')!
    expect(right).toHaveTextContent('Due')
    expect(right).toHaveTextContent(/[A-Z][a-z]{2} \d+/)
    expect(right.querySelector('.node__tag-time')).toHaveTextContent(/^\d\d:\d\d$/)
    expect(current().querySelector('.node__badge')).toBeNull() // replaced by the two tags
  })

  it('shows how long is left and describes it for screen readers', () => {
    renderPath()
    expect(current().querySelector('.node__when')).toHaveTextContent(/^in \d+ (days?|hours?)$/)
    expect(current()).toHaveAccessibleName(/current module, opened .*next deadline [A-Z][a-z]{2} \d+, \d\d:\d\d/)
  })

  it('other modules keep the simple date badge and have no side tags', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('.node__tag')).toHaveLength(2) // only the current module
    expect(container.querySelectorAll('.node__when')).toHaveLength(1)
  })

  it('a locked module is never current, even when its window would match', () => {
    const { container } = render(
      <MemoryRouter>
        <JourneyPath modules={modules} now={NOW} isLocked={() => true} />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('.node--active')).toHaveLength(0)
    expect(container.querySelectorAll('.node__tag')).toHaveLength(0)
  })

  it('no module is current when none has a running window', () => {
    const far = new Date(2030, 0, 1)
    const { container } = render(
      <MemoryRouter>
        <JourneyPath modules={modules} now={far} isLocked={() => false} />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('.node--active')).toHaveLength(0)
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

  it('shows the exact due date AND time, not just the day', () => {
    render(<DeadlinesCard entries={upcomingDeadlines(modules, NOW, 5)} now={NOW} />)
    const rows = screen.getAllByRole('listitem')
    for (const row of rows) expect(row).toHaveTextContent(/[A-Z][a-z]{2} \d+, \d\d:\d\d/)
    expect(rows[1]).toHaveTextContent('18:00')
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
