import { describe, expect, it } from 'vitest'
import { audienceCounts, inAudience } from './adminNotifications'

const NOW = new Date('2026-11-07T12:00:00Z')
const student = { roles: ['student' as const] }
const both = { roles: ['mentor' as const, 'lecturer' as const] }

describe('audiences', () => {
  it('each audience reaches its own people; admins are never part of it', () => {
    expect([inAudience(student, 'all'), inAudience(student, 'students'), inAudience(student, 'mentors')]).toEqual([true, true, false])
    expect([inAudience(both, 'mentors'), inAudience(both, 'lecturers'), inAudience(both, 'students')]).toEqual([true, true, false])
    expect([inAudience({ roles: ['admin'] }, 'all'), inAudience({ roles: ['admin'] }, 'students')]).toEqual([false, false])
  })

  it('a lecturer role that has ended is not counted', () => {
    const ended = { roles: ['mentor' as const, 'lecturer' as const], roleUntil: { lecturer: '2026-11-01T00:00:00Z' } }
    expect(inAudience(ended, 'lecturers', NOW)).toBe(false)
    expect(inAudience(ended, 'mentors', NOW)).toBe(true)
  })

  it('counts people once in "everyone", skipping those who left', () => {
    const counts = audienceCounts([student, student, both, { roles: ['student' as const], leftAt: '2026-11-01T00:00:00Z' }, { roles: ['admin' as const] }], NOW)
    expect(counts).toEqual({ all: 3, students: 2, mentors: 1, lecturers: 1 })
  })
})
