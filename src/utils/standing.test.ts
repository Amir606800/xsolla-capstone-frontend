import { describe, expect, it } from 'vitest'
import type { StandingLevel, WeeklyStanding } from '../types/standing'
import {
  RED_LIMIT,
  STANDING_LABEL,
  STANDING_LEVELS,
  STANDING_MEANING,
  YELLOW_LIMIT,
  analyseStandings,
  parseStandingLevel,
  standingAlert,
} from './standing'

const G: StandingLevel = 'green'
const Y: StandingLevel = 'yellow'
const R: StandingLevel = 'red'

/** Ratings for consecutive weeks starting at week 1. */
const weeks = (...levels: StandingLevel[]): WeeklyStanding[] =>
  levels.map((level, i) => ({ week: i + 1, level, assessedAt: `2026-03-${String(i + 1).padStart(2, '0')}T18:00:00Z` }))

const effective = (...levels: StandingLevel[]) => analyseStandings(weeks(...levels)).weeks.map((w) => w.effective)

describe('the levels', () => {
  it('are green, yellow and red', () => {
    expect(STANDING_LEVELS).toEqual(['green', 'yellow', 'red'])
  })

  it('are named after what they say about the student', () => {
    expect(STANDING_LABEL).toEqual({ green: 'On track', yellow: 'Falling behind', red: 'No progress' })
  })

  it('are explained in the words of the program rules', () => {
    expect(STANDING_MEANING.green).toMatch(/on track or exceeding expectations/)
    expect(STANDING_MEANING.yellow).toMatch(/falling behind but putting in effort/)
    expect(STANDING_MEANING.red).toMatch(/no meaningful progress/i)
  })

  it('the limits are 4 yellow weeks and 2 red weeks', () => {
    expect(YELLOW_LIMIT).toBe(4)
    expect(RED_LIMIT).toBe(2)
  })
})

describe('parseStandingLevel', () => {
  it('reads a level in any letter case', () => {
    expect(parseStandingLevel('Green')).toBe('green')
    expect(parseStandingLevel(' RED ')).toBe('red')
  })

  it('does not accept anything else (old points, other words)', () => {
    for (const v of ['90', 90, 'blue', '', null, undefined]) expect(parseStandingLevel(v)).toBeUndefined()
  })
})

describe('analyseStandings: nothing rated', () => {
  it('has no current standing and no warnings', () => {
    const s = analyseStandings([])
    expect(s).toMatchObject({ current: null, yellowStreak: 0, redStreak: 0, removal: false })
    expect(s.counts).toEqual({ green: 0, yellow: 0, red: 0, total: 0 })
    expect(standingAlert(s)).toBeNull()
  })
})

describe('analyseStandings: the current standing', () => {
  it('is the level of the latest rated week', () => {
    expect(analyseStandings(weeks(G, Y)).current).toBe('yellow')
    expect(analyseStandings(weeks(R, G)).current).toBe('green')
  })

  it('does not depend on the order the ratings arrive in', () => {
    const shuffled = weeks(G, Y, R).reverse()
    expect(analyseStandings(shuffled).weeks.map((w) => w.week)).toEqual([1, 2, 3])
    expect(analyseStandings(shuffled).current).toBe('red')
  })

  it('uses the last rating when a week appears twice', () => {
    const s = analyseStandings([...weeks(G), { week: 1, level: R, assessedAt: '2026-03-09T00:00:00Z' }])
    expect(s.weeks).toHaveLength(1)
    expect(s.current).toBe('red')
  })

  it('counts the weeks per level', () => {
    expect(analyseStandings(weeks(G, G, Y, R)).counts).toEqual({ green: 2, yellow: 1, red: 1, total: 4 })
  })
})

describe('analyseStandings: 4 consecutive yellow weeks escalate to red', () => {
  it('three yellow weeks stay yellow', () => {
    expect(effective(Y, Y, Y)).toEqual([Y, Y, Y])
  })

  it('the fourth yellow week in a row counts as red, and is flagged as escalated', () => {
    const s = analyseStandings(weeks(Y, Y, Y, Y))
    expect(s.weeks.map((w) => w.effective)).toEqual([Y, Y, Y, R])
    expect(s.weeks.map((w) => w.escalated)).toEqual([false, false, false, true])
    expect(s.weeks[3].level).toBe('yellow') // the mentor still rated it yellow
    expect(s.current).toBe('red')
  })

  it('a green week in between starts the count again', () => {
    expect(effective(Y, Y, Y, G, Y)).toEqual([Y, Y, Y, G, Y])
  })

  it('a red week in between starts the count again', () => {
    expect(effective(Y, Y, Y, R, Y, Y, Y)).toEqual([Y, Y, Y, R, Y, Y, Y])
  })

  it('after an escalation the yellow count starts again', () => {
    expect(effective(Y, Y, Y, Y, Y, Y, Y, Y)).toEqual([Y, Y, Y, R, Y, Y, Y, R])
  })

  it('a gap between two rated weeks breaks the run', () => {
    const gap: WeeklyStanding[] = [
      { week: 1, level: Y, assessedAt: 'x' },
      { week: 2, level: Y, assessedAt: 'x' },
      { week: 3, level: Y, assessedAt: 'x' },
      { week: 5, level: Y, assessedAt: 'x' }, // week 4 was not rated
    ]
    expect(analyseStandings(gap).weeks.map((w) => w.effective)).toEqual([Y, Y, Y, Y])
  })
})

describe('analyseStandings: 2 consecutive red weeks mean removal', () => {
  it('one red week is not removal', () => {
    const s = analyseStandings(weeks(G, R))
    expect(s.redStreak).toBe(1)
    expect(s.removal).toBe(false)
  })

  it('two red weeks in a row are', () => {
    const s = analyseStandings(weeks(G, R, R))
    expect(s.redStreak).toBe(2)
    expect(s.removal).toBe(true)
  })

  it('red, green, red is not consecutive', () => {
    const s = analyseStandings(weeks(R, G, R))
    expect(s.redStreak).toBe(1)
    expect(s.removal).toBe(false)
  })

  it('red, yellow, red is not consecutive either', () => {
    expect(analyseStandings(weeks(R, Y, R)).removal).toBe(false)
  })

  it('a red week right after an escalated one is removal', () => {
    const s = analyseStandings(weeks(Y, Y, Y, Y, R)) // 4th yellow counts as red, then red
    expect(s.redStreak).toBe(2)
    expect(s.removal).toBe(true)
  })

  it('a yellow week after an escalated red is not removal', () => {
    expect(analyseStandings(weeks(Y, Y, Y, Y, Y)).removal).toBe(false)
  })

  it('a gap between two red weeks is not consecutive', () => {
    const s = analyseStandings([
      { week: 1, level: R, assessedAt: 'x' },
      { week: 3, level: R, assessedAt: 'x' },
    ])
    expect(s.removal).toBe(false)
  })

  it('a green week clears an earlier red', () => {
    const s = analyseStandings(weeks(R, G))
    expect(s).toMatchObject({ redStreak: 0, removal: false, current: 'green' })
  })
})

describe('analyseStandings: streaks at the end', () => {
  it('counts the yellow weeks in a row up to now', () => {
    expect(analyseStandings(weeks(G, Y, Y)).yellowStreak).toBe(2)
    expect(analyseStandings(weeks(Y, Y, G)).yellowStreak).toBe(0)
  })
})

describe('standingAlert', () => {
  const alert = (...levels: StandingLevel[]) => standingAlert(analyseStandings(weeks(...levels)))

  it('says nothing while the student is on track', () => {
    expect(alert(G, G)).toBeNull()
  })

  it('warns about a run of yellow weeks, and says what happens at 4', () => {
    expect(alert(Y)).toMatchObject({ tone: 'warning', text: '1 yellow week in a row. At 4 in a row it counts as red.' })
    expect(alert(G, Y, Y)).toMatchObject({ tone: 'warning', text: '2 yellow weeks in a row. At 4 in a row it counts as red.' })
  })

  it('is more urgent at the third yellow week', () => {
    expect(alert(Y, Y, Y)?.text).toMatch(/3 yellow weeks in a row\. One more yellow week counts as red/)
  })

  it('warns after a red week that one more means removal', () => {
    expect(alert(G, R)).toMatchObject({ tone: 'danger' })
    expect(alert(G, R)?.text).toBe('One more red week in a row means removal from the program.')
  })

  it('also explains an escalated week', () => {
    expect(alert(Y, Y, Y, Y)?.text).toMatch(/4 yellow weeks in a row count as red\. One more red week in a row means removal/)
  })

  it('tells the student to talk to the mentor after two red weeks', () => {
    expect(alert(R, R)).toMatchObject({ tone: 'danger' })
    expect(alert(R, R)?.text).toMatch(/2 red weeks in a row mean removal from the program\. Please talk to your mentor/)
  })

  it('goes away after a green week', () => {
    expect(alert(R, G)).toBeNull()
  })
})
