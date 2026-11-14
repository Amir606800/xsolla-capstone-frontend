import { describe, expect, it } from 'vitest'
import type { AdminReview } from '../types/mentorReview'
import { ALL_REVIEWS, average, byMentor, filterReviews, formatPercent, formatScore, reasonCounts, summarise, topicCounts } from './reviewAnalytics'

let n = 0
function review(over: Partial<AdminReview> = {}): AdminReview {
  n += 1
  return {
    id: `r${n}`,
    moduleId: 'm1',
    studentId: n,
    studentName: `Student ${n}`,
    mentorId: 900,
    mentorName: 'Rashad',
    teamName: 'Team 3',
    hadSession: true,
    topics: ['goals'],
    ratings: { clarity: 4, engagement: 4, comfort: 4, time: 4 },
    overall: 4,
    submittedAt: `2026-11-0${1 + (n % 8)}T10:00:00Z`,
    ...over,
  }
}

describe('filterReviews', () => {
  const rows = [
    review({ id: 'a', studentName: 'Aysel', moduleId: 'm1', overall: 5, submittedAt: '2026-11-01T10:00:00Z' }),
    review({ id: 'b', studentName: 'Bakhtiyar', moduleId: 'm2', overall: 2, comment: 'Too short', submittedAt: '2026-11-08T10:00:00Z' }),
    review({ id: 'c', studentName: 'Cavid', mentorId: 901, mentorName: 'Aysel M.', hadSession: false, noSessionReason: 'not-scheduled', topics: [], ratings: {}, overall: 3, submittedAt: '2026-11-05T10:00:00Z' }),
  ]
  const ids = (f: Partial<typeof ALL_REVIEWS>) => filterReviews(rows, { ...ALL_REVIEWS, ...f }).map((r) => r.id)

  it('everything, newest first', () => expect(ids({})).toEqual(['b', 'c', 'a']))
  it('one week', () => expect(ids({ moduleId: 'm2' })).toEqual(['b']))
  it('one mentor', () => expect(ids({ mentorId: 901 })).toEqual(['c']))
  it('low scores are 2 or less', () => expect(ids({ show: 'low' })).toEqual(['b']))
  it('with a comment', () => expect(ids({ show: 'comments' })).toEqual(['b']))
  it('no session', () => expect(ids({ show: 'no-session' })).toEqual(['c']))
  it('searches the student, the mentor, the team and the comment, ignoring case', () => {
    expect(ids({ query: 'aysel' })).toEqual(['c', 'a']) // a student and a mentor
    expect(ids({ query: ' TOO SHORT ' })).toEqual(['b'])
    expect(ids({ query: 'team 3' })).toEqual(['b', 'c', 'a'])
    expect(ids({ query: 'nobody' })).toEqual([])
  })
  it('does not change the list it is given', () => {
    const before = rows.map((r) => r.id)
    filterReviews(rows, ALL_REVIEWS)
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})

describe('summarise', () => {
  it('counts, averages and the low scores', () => {
    const s = summarise([review({ overall: 5 }), review({ overall: 1, comment: 'Bad week' }), review({ overall: 3, hadSession: false, ratings: {} })])
    expect(s.count).toBe(3)
    expect(s.overall).toBe(3)
    expect(s.sessions).toBe(2)
    expect(s.sessionRate).toBeCloseTo(2 / 3)
    expect(s.low).toBe(1)
    expect(s.withComment).toBe(1)
  })

  it('averages a statement only over the reviews that rated it (no session = no rating)', () => {
    const s = summarise([review({ ratings: { clarity: 5, engagement: 3, comfort: 4, time: 2 } }), review({ ratings: { clarity: 3, engagement: 3, comfort: 4, time: 4 } }), review({ hadSession: false, ratings: {} })])
    expect(s.ratings.clarity).toBe(4)
    expect(s.ratings.time).toBe(3)
  })

  it('nothing to average gives null, shown as a dash', () => {
    const s = summarise([])
    expect(s.overall).toBeNull()
    expect(s.sessionRate).toBeNull()
    expect(s.ratings.clarity).toBeNull()
    expect(formatScore(s.overall)).toBe('—')
    expect(formatPercent(s.sessionRate)).toBe('—')
  })
})

describe('byMentor', () => {
  it('one row per mentor, A-Z, each with its own numbers', () => {
    const rows = byMentor([
      review({ mentorId: 902, mentorName: 'Zaur', overall: 2 }),
      review({ mentorId: 900, mentorName: 'Aysel', overall: 5 }),
      review({ mentorId: 900, mentorName: 'Aysel', overall: 4 }),
    ])
    expect(rows.map((r) => [r.mentorName, r.count, r.overall])).toEqual([
      ['Aysel', 2, 4.5],
      ['Zaur', 1, 2],
    ])
  })

  it('takes the team and the name from the mentor’s latest review', () => {
    const [row] = byMentor([
      review({ mentorId: 900, teamName: 'Team 1', submittedAt: '2026-11-01T00:00:00Z' }),
      review({ mentorId: 900, teamName: 'Team 3', submittedAt: '2026-11-09T00:00:00Z' }),
    ])
    expect(row.teamName).toBe('Team 3')
  })
})

describe('topics and reasons', () => {
  it('count each topic a review names, most often first, and leave out the ones never named', () => {
    const t = topicCounts([review({ topics: ['goals', 'homework'] }), review({ topics: ['homework'] }), review({ hadSession: false, topics: [] })])
    expect(t).toEqual([
      { topic: 'homework', count: 2 },
      { topic: 'goals', count: 1 },
    ])
  })

  it('count the reasons for no session, only from reviews with no session', () => {
    const r = reasonCounts([
      review({ hadSession: false, noSessionReason: 'not-scheduled', topics: [] }),
      review({ hadSession: false, noSessionReason: 'not-scheduled', topics: [] }),
      review({ hadSession: false, noSessionReason: 'other', topics: [] }),
      review({ hadSession: true }),
    ])
    expect(r).toEqual([
      { reason: 'not-scheduled', count: 2 },
      { reason: 'other', count: 1 },
    ])
  })
})

describe('numbers', () => {
  it('average of nothing is null', () => expect(average([])).toBeNull())
  it('one decimal and whole percent', () => {
    expect(formatScore(4.25)).toBe('4.3')
    expect(formatScore(4)).toBe('4.0')
    expect(formatPercent(0.857)).toBe('86%')
  })
})
