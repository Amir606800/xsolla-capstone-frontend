import { describe, expect, it } from 'vitest'
import type { CourseModule } from '../types/course'
import { draftToReview, emptyDraft, reviewDue, validateReview } from './mentorReview'

// weeks run Monday 00:00 to Sunday 23:59 (local time)
const week = (id: string, position: number, monday: Date): CourseModule => {
  const closes = new Date(monday)
  closes.setDate(closes.getDate() + 6)
  closes.setHours(23, 59, 0, 0)
  return { id, position, title: `Week ${position}`, opensAt: monday.toISOString(), closesAt: closes.toISOString(), items: [] }
}
const modules = [week('m1', 1, new Date(2026, 10, 2)), week('m2', 2, new Date(2026, 10, 9)), week('m3', 3, new Date(2026, 10, 16))]
const done = (...ids: string[]) => ids.map((moduleId) => ({ moduleId, submittedAt: 'x' }))

describe('reviewDue', () => {
  it('nothing on a weekday when last week is reviewed', () => {
    expect(reviewDue(modules, done('m1'), new Date(2026, 10, 11, 12))).toBeNull()
  })

  it('on Saturday and Sunday the running week is open as a reminder, not a lock', () => {
    for (const day of [14, 15]) {
      expect(reviewDue(modules, done('m1'), new Date(2026, 10, day, 12))).toMatchObject({ module: { id: 'm2' }, locked: false })
    }
    expect(reviewDue(modules, done('m1'), new Date(2026, 10, 13, 12))).toBeNull() // Friday
    expect(reviewDue(modules, done('m1', 'm2'), new Date(2026, 10, 14, 12))).toBeNull() // already sent
  })

  it('once the week is over and its review is missing, the LMS is locked', () => {
    expect(reviewDue(modules, done('m1'), new Date(2026, 10, 16, 0, 5))).toMatchObject({ module: { id: 'm2' }, locked: true })
    expect(reviewDue(modules, done('m1', 'm2'), new Date(2026, 10, 16, 0, 5))).toBeNull()
  })

  it('only the last finished week is asked for, not older ones', () => {
    expect(reviewDue(modules, done('m2'), new Date(2026, 10, 18, 12))).toBeNull()
    expect(reviewDue(modules, [], new Date(2026, 10, 18, 12))).toMatchObject({ module: { id: 'm2' }, locked: true })
  })

  it('a missing last week wins over the weekend reminder', () => {
    expect(reviewDue(modules, [], new Date(2026, 10, 14, 12))).toMatchObject({ module: { id: 'm1' }, locked: true })
  })

  it('weeks without dates never ask for a review', () => {
    expect(reviewDue([{ id: 'x', position: 1, title: 'No dates', items: [] }], [], new Date(2026, 10, 18))).toBeNull()
  })
})

describe('validateReview', () => {
  const full = { ...emptyDraft(), hadSession: true, topics: ['goals' as const], ratings: { clarity: 5, engagement: 4, comfort: 5, time: 3 } as const, overall: 4 as const }

  it('an untouched form misses the session answer and the overall rating', () => {
    expect(Object.keys(validateReview(emptyDraft())).sort()).toEqual(['hadSession', 'overall'])
  })

  it('with a session: a topic and every statement are needed; "Other" needs its text', () => {
    expect(validateReview(full)).toEqual({})
    expect(validateReview({ ...full, topics: [] }).topics).toBeDefined()
    expect(validateReview({ ...full, ratings: { clarity: 5 } }).ratings).toBeDefined()
    expect(validateReview({ ...full, topics: ['other'] }).otherTopic).toBeDefined()
    expect(validateReview({ ...full, topics: ['other'], otherTopic: 'CV' })).toEqual({})
  })

  it('without a session: only the reason and the overall rating', () => {
    const none = { ...emptyDraft(), hadSession: false, overall: 2 as const }
    expect(Object.keys(validateReview(none))).toEqual(['noSessionReason'])
    expect(validateReview({ ...none, noSessionReason: 'not-scheduled' })).toEqual({})
  })

  it('a comment has a length limit', () => {
    expect(validateReview({ ...full, comment: 'x'.repeat(1001) }).comment).toBeDefined()
  })
})

describe('draftToReview', () => {
  it('leaves out what does not apply to the answer', () => {
    expect(draftToReview({ ...emptyDraft(), hadSession: false, noSessionReason: 'other', topics: ['goals'], overall: 1, comment: '  ' }, 'm2')).toEqual({
      moduleId: 'm2',
      hadSession: false,
      noSessionReason: 'other',
      overall: 1,
    })
    expect(
      draftToReview({ ...emptyDraft(), hadSession: true, topics: ['goals'], otherTopic: 'ignored', ratings: { clarity: 5, engagement: 5, comfort: 5, time: 5 }, overall: 5, comment: ' Great ' }, 'm2'),
    ).toEqual({ moduleId: 'm2', hadSession: true, topics: ['goals'], ratings: { clarity: 5, engagement: 5, comfort: 5, time: 5 }, overall: 5, comment: 'Great' })
  })
})
