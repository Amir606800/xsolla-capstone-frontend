import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StandingLevel } from '../types/standing'
import { analyseStandings } from '../utils/standing'
import { GradedPill } from './GradedPill'
import { StandingBadge } from './StandingBadge'
import { StandingBar } from './StandingBar'
import { StandingPill } from './StandingPill'
import { WeekTiles } from './WeekTiles'

describe('StandingPill', () => {
  it.each([
    ['green', 'On track'],
    ['yellow', 'Falling behind'],
    ['red', 'No progress'],
  ] as const)('%s reads "%s", so the level is not only a colour', (level, label) => {
    render(<StandingPill level={level} />)
    const pill = screen.getByText(label)
    expect(pill).toHaveClass(`standing-pill--${level}`)
    expect(pill.querySelector('svg')).not.toBeNull() // an icon as well
  })
})

describe('StandingBadge', () => {
  it('shows the level in words', () => {
    render(<StandingBadge standing="yellow" />)
    expect(screen.getByRole('img', { name: 'Current standing: Falling behind' })).toHaveClass('standing--yellow')
  })

  it('is grey and says so when nothing is rated yet', () => {
    render(<StandingBadge standing={null} />)
    expect(screen.getByRole('img', { name: 'Current standing: not rated yet' })).toHaveClass('standing--none')
  })
})

describe('StandingBar', () => {
  it('describes the split in words and shows a count for each level', () => {
    render(<StandingBar counts={{ green: 3, yellow: 2, red: 1, total: 6 }} />)
    expect(screen.getByRole('img', { name: '3 on track, 2 falling behind, 1 no progress' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Weeks by level' })).toHaveTextContent('3 On track')
  })

  it('sizes each part by its count and skips empty levels', () => {
    const { container } = render(<StandingBar counts={{ green: 3, yellow: 0, red: 1, total: 4 }} />)
    const parts = container.querySelectorAll('.standing-bar__part')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toHaveStyle({ flexGrow: '3' })
  })

  it('says so when no week is rated', () => {
    render(<StandingBar counts={{ green: 0, yellow: 0, red: 0, total: 0 }} />)
    expect(screen.getByRole('img', { name: 'No weeks rated yet' })).toBeInTheDocument()
  })
})

describe('WeekTiles', () => {
  const rated = (levels: StandingLevel[]) =>
    analyseStandings(levels.map((level, i) => ({ week: i + 1, level, assessedAt: 'x' }))).weeks

  it('has one tile per week, in order', () => {
    render(<WeekTiles totalWeeks={12} weeks={[]} />)
    const tiles = screen.getAllByRole('listitem')
    expect(tiles).toHaveLength(12)
    expect(tiles.map((t) => t.textContent)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)))
  })

  it('colours the rated weeks and leaves the others grey', () => {
    render(<WeekTiles totalWeeks={4} weeks={rated(['green', 'yellow', 'red'])} />)
    const [a, b, c, d] = screen.getAllByRole('listitem')
    expect([a, b, c, d].map((t) => t.className)).toEqual([
      'week-tile week-tile--green',
      'week-tile week-tile--yellow',
      'week-tile week-tile--red',
      'week-tile week-tile--none',
    ])
    expect(d).toHaveAccessibleName('Week 4: not rated yet')
  })

  it('shows the 4th yellow week in a row as red and says why', () => {
    render(<WeekTiles totalWeeks={5} weeks={rated(['yellow', 'yellow', 'yellow', 'yellow'])} />)
    const tile = screen.getAllByRole('listitem')[3]
    expect(tile).toHaveClass('week-tile--red')
    expect(tile).toHaveAccessibleName('Week 4: No progress (4th yellow week in a row)')
  })
})

describe('GradedPill', () => {
  it('says "Graded"', () => {
    render(<GradedPill />)
    expect(screen.getByText('Graded')).toBeInTheDocument()
  })
})
