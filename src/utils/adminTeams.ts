import type { TeamPlan } from '../mocks/directory'

/** A random number in [0, 1), like Math.random: passed in so tests can fix the "randomness". */
export type Random = () => number

export const MIN_TEAM_SIZE = 3
export const MAX_TEAM_SIZE = 6
export const DEFAULT_TEAM_SIZE = 5

/** Fisher-Yates: a shuffled copy. */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** How many teams `students` split into with at most `maxSize` each, and how big each one is (as even as can be). */
export function teamSizes(students: number, maxSize: number): number[] {
  if (students <= 0) return []
  const count = Math.ceil(students / Math.max(1, maxSize))
  const base = Math.floor(students / count)
  const extra = students % count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

/**
 * Random teams: the students are shuffled and dealt into teams of at most `maxSize` (sizes differ by
 * at most one), and each team gets a different random mentor. With fewer mentors than teams the last
 * teams have no mentor.
 */
export function planTeams(studentIds: number[], mentorIds: number[], maxSize: number, random: Random = Math.random): TeamPlan[] {
  const students = shuffle(studentIds, random)
  const mentors = shuffle(mentorIds, random)
  let at = 0
  return teamSizes(students.length, maxSize).map((size, i) => {
    const team = { mentorId: mentors[i] ?? null, studentIds: students.slice(at, at + size) }
    at += size
    return team
  })
}
