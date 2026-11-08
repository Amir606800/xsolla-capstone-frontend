import { describe, expect, it } from 'vitest'
import { buildMockModules } from './courses'
import { buildMockSubmissions, comment, handIn, submissionsOf, teamSubmissions } from './submissions'

const NOW = new Date(2026, 10, 4, 12, 0)
const RASHAD = { id: 900, name: 'Rashad Aliyev' }
const AYSEL = { id: 901, name: 'Aysel Mammadova' }

describe('demo data', () => {
  const store = buildMockSubmissions(NOW)

  it("Sam's work is exactly what the course demo shows him", () => {
    const shown = buildMockModules(NOW)
      .flatMap((m) => m.items)
      .filter((i) => i.type === 'assignment' && i.submission)
    expect(Object.values(store).filter((s) => s.studentId === 1)).toHaveLength(shown.length)
  })

  it("last week's work of Sam's teammates has no comment yet, and one task was missed", () => {
    const week5 = Object.values(store).filter((s) => s.assignmentId.startsWith('m5-') && [101, 102, 103, 104].includes(s.studentId))
    expect(week5).toHaveLength(4 * 3 - 1)
    expect(week5.every((s) => !s.feedback)).toBe(true)
  })

  it('earlier work has a comment, and nobody else\'s task is graded', () => {
    const old = Object.values(store).filter((s) => s.assignmentId.startsWith('m2-') && s.studentId === 101)
    expect(old.every((s) => s.feedback && s.commentedBy?.id === 900)).toBe(true)
    expect(Object.values(store).filter((s) => s.studentId !== 1).some((s) => s.gradedAt)).toBe(false)
  })
})

describe('rules', () => {
  it('a student reads only their own work', () => {
    handIn(1, 'm6-a2', { submittedAt: NOW.toISOString(), textBody: 'mine' }, NOW)
    expect(submissionsOf(1, NOW)['m6-a2']?.textBody).toBe('mine')
    expect(submissionsOf(101, NOW)['m6-a2']).toBeUndefined()
  })

  it('a mentor sees only their own team', () => {
    expect(teamSubmissions(RASHAD, NOW).every((s) => [1, 101, 102, 103, 104].includes(s.studentId))).toBe(true)
    expect(teamSubmissions(AYSEL, NOW).some((s) => s.studentId === 101)).toBe(false)
  })

  it('a comment needs text, reaches the student and can be changed; it does not grade the task', () => {
    expect(() => comment(RASHAD, 101, 'm5-a1', '   ', NOW)).toThrow('Write a comment')
    comment(RASHAD, 101, 'm5-a1', 'Nice README', NOW)
    const later = new Date(NOW.getTime() + 60_000)
    const after = comment(RASHAD, 101, 'm5-a1', 'Nice README, add tests', later)
    const s = after.find((x) => x.studentId === 101 && x.assignmentId === 'm5-a1')!
    expect(s).toMatchObject({ feedback: 'Nice README, add tests', commentedAt: later.toISOString(), commentedBy: RASHAD })
    expect(s.gradedAt).toBeUndefined()
    expect(submissionsOf(101, NOW)['m5-a1']).toMatchObject({ feedback: 'Nice README, add tests' })
  })

  it('the student can still hand in again after a comment, and the comment stays', () => {
    comment(RASHAD, 101, 'm5-a1', 'Fix the tests', NOW)
    handIn(101, 'm5-a1', { submittedAt: NOW.toISOString(), textBody: 'v2' }, NOW)
    expect(submissionsOf(101, NOW)['m5-a1']).toMatchObject({ textBody: 'v2', feedback: 'Fix the tests' })
  })

  it('every new version keeps the ones before it, newest first (without the comment)', () => {
    handIn(1, 'm6-a2', { submittedAt: '2026-11-08T10:00:00.000Z', textBody: 'v1', files: [{ name: 'a.pdf', sizeBytes: 1 }] }, NOW)
    handIn(1, 'm6-a2', { submittedAt: '2026-11-08T11:00:00.000Z', textBody: 'v2' }, NOW)
    const third = handIn(1, 'm6-a2', { submittedAt: '2026-11-08T12:00:00.000Z', textBody: 'v3' }, NOW)
    expect(third.history?.map((v) => v.textBody)).toEqual(['v2', 'v1'])
    const stored = submissionsOf(1, NOW)['m6-a2']
    expect(stored).toMatchObject({ textBody: 'v3' })
    expect(stored.history).toEqual([
      { submittedAt: '2026-11-08T11:00:00.000Z', textBody: 'v2' },
      { submittedAt: '2026-11-08T10:00:00.000Z', textBody: 'v1', files: [{ name: 'a.pdf', sizeBytes: 1 }] },
    ])
    // the mentor sees the history too
    expect(teamSubmissions(RASHAD, NOW).find((s) => s.studentId === 1 && s.assignmentId === 'm6-a2')!.history).toHaveLength(2)
  })

  it("a mentor cannot comment on another team's student, or on work never handed in", () => {
    expect(() => comment(AYSEL, 101, 'm5-a1', 'x', NOW)).toThrow('not in your team')
    expect(() => comment(RASHAD, 102, 'm5-a2', 'x', NOW)).toThrow('has not handed anything in')
  })
})
