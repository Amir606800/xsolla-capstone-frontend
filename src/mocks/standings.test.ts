import { describe, expect, it } from 'vitest'
import { buildMockStandings, buildMockStandingStore, gradeWeek, standingsOf, teamStandings } from './standings'

const NOW = new Date(2026, 10, 4, 12, 0)
const RASHAD = { id: 900, name: 'Rashad Aliyev' }
const AYSEL = { id: 901, name: 'Aysel Mammadova' }

describe('demo data', () => {
  it("Sam's weeks are the ones the student pages always showed", () => {
    expect(standingsOf(1, NOW)).toEqual(buildMockStandings(NOW))
  })

  it("Sam's teammates are graded for weeks 1-4; week 5 is still to give", () => {
    const store = buildMockStandingStore(NOW)
    for (const id of [101, 102, 103, 104]) {
      const weeks = Object.values(store).filter((s) => s.studentId === id).map((s) => s.week)
      expect(weeks.sort()).toEqual([1, 2, 3, 4])
    }
  })
})

describe('rules', () => {
  it('the mentor grades a week; the student sees it', () => {
    gradeWeek(RASHAD, 101, 5, 'yellow', ' Catch up on routing ', NOW)
    expect(standingsOf(101, NOW).find((s) => s.week === 5)).toMatchObject({ level: 'yellow', note: 'Catch up on routing' })
  })

  it('changing a grade replaces it: one grade per week', () => {
    gradeWeek(RASHAD, 101, 5, 'yellow', '', NOW)
    gradeWeek(RASHAD, 101, 5, 'green', '', NOW)
    const week5 = standingsOf(101, NOW).filter((s) => s.week === 5)
    expect(week5).toEqual([expect.objectContaining({ level: 'green' })])
  })

  it('a mentor grades only their own team, and only weeks that have started', () => {
    expect(() => gradeWeek(AYSEL, 101, 5, 'green', '', NOW)).toThrow('not in your team')
    expect(() => gradeWeek(RASHAD, 101, 8, 'green', '', NOW)).toThrow('not started')
    expect(teamStandings(AYSEL, NOW).some((s) => s.studentId === 101)).toBe(false)
  })
})
