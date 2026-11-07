import { describe, expect, it } from 'vitest'
import { planTeams, shuffle, teamSizes } from './adminTeams'

const ids = (n: number, from = 1) => Array.from({ length: n }, (_, i) => from + i)
/** A repeatable "random": a simple counter-based sequence. */
const seeded = () => {
  let x = 7
  return () => {
    x = (x * 48271) % 2147483647
    return x / 2147483647
  }
}

describe('team sizes', () => {
  it('splits as evenly as possible, never above the maximum', () => {
    expect(teamSizes(29, 5)).toEqual([5, 5, 5, 5, 5, 4])
    expect(teamSizes(29, 4)).toEqual([4, 4, 4, 4, 4, 3, 3, 3])
    expect(teamSizes(10, 5)).toEqual([5, 5])
    expect(teamSizes(11, 5)).toEqual([4, 4, 3])
    expect(teamSizes(3, 5)).toEqual([3])
    expect(teamSizes(0, 5)).toEqual([])
  })
})

describe('shuffle', () => {
  it('is a copy with the same items, in another order', () => {
    const original = ids(10)
    const out = shuffle(original, seeded())
    expect(out).not.toBe(original)
    expect([...out].sort((a, b) => a - b)).toEqual(original)
    expect(out).not.toEqual(original)
    expect(original).toEqual(ids(10))
  })
})

describe('planTeams', () => {
  it('puts every student in exactly one team and gives each team its own mentor', () => {
    const plan = planTeams(ids(29), ids(8, 900), 5, seeded())
    expect(plan.map((t) => t.studentIds.length)).toEqual([5, 5, 5, 5, 5, 4])
    expect(plan.flatMap((t) => t.studentIds).sort((a, b) => a - b)).toEqual(ids(29))
    const mentors = plan.map((t) => t.mentorId)
    expect(new Set(mentors).size).toBe(6)
    for (const m of mentors) expect(ids(8, 900)).toContain(m)
  })

  it('with fewer mentors than teams the last teams have none', () => {
    const plan = planTeams(ids(29), ids(4, 900), 5, seeded())
    expect(plan.filter((t) => t.mentorId === null)).toHaveLength(2)
    expect(plan.slice(0, 4).every((t) => t.mentorId !== null)).toBe(true)
  })

  it('without mentors or students', () => {
    expect(planTeams(ids(6), [], 5, seeded()).every((t) => t.mentorId === null)).toBe(true)
    expect(planTeams([], ids(3, 900), 5, seeded())).toEqual([])
  })

  it('different shuffles give different teams', () => {
    const a = planTeams(ids(29), ids(6, 900), 5, seeded())
    const b = planTeams(ids(29), ids(6, 900), 5, () => 0.3)
    expect(a).not.toEqual(b)
  })
})
