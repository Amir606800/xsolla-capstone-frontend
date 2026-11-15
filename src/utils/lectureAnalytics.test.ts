import { describe, expect, it } from 'vitest'
import type { AdminLectureReview } from '../types/lectureReview'
import { ALL_LECTURE_REVIEWS, byLecturer, filterLectureReviews, lectureKey, lecturesOf, NO_LECTURER, summariseLectures } from './lectureAnalytics'

let n = 0
function review(over: Partial<AdminLectureReview> & { lectureTitle?: string; eventId?: string } = {}): AdminLectureReview {
  n += 1
  const { lectureTitle = 'Goroutines', eventId = '41', ...rest } = over
  return {
    id: `r${n}`,
    lecture: { eventId, title: lectureTitle, startsAt: '2026-11-12T11:00:00Z', endsAt: '2026-11-12T13:00:00Z', moduleId: '3', moduleTitle: 'Week 3: Concurrency' },
    lecturers: [{ id: 20, name: 'Leyla' }],
    studentId: n,
    studentName: `Student ${n}`,
    overall: 4,
    clarity: 4,
    practice: 4,
    confidence: 4,
    pace: 'just_right',
    submittedAt: `2026-11-1${3 + (n % 5)}T10:00:00Z`,
    ...rest,
  }
}

describe('filterLectureReviews', () => {
  const rows = [
    review({ id: 'a', studentName: 'Aysel', overall: 5, submittedAt: '2026-11-13T10:00:00Z' }),
    review({ id: 'b', studentName: 'Bakhtiyar', overall: 2, improve: 'Too fast for me', submittedAt: '2026-11-15T10:00:00Z' }),
    review({ id: 'c', studentName: 'Cavid', lecturers: [], eventId: '50', lectureTitle: 'Intro', liked: 'Nice start', submittedAt: '2026-11-14T10:00:00Z' }),
    review({ id: 'd', studentName: 'Dilara', lecturers: [{ id: 21, name: 'Rashad' }, { id: 20, name: 'Leyla' }], eventId: '60', lectureTitle: 'Channels', submittedAt: '2026-11-12T10:00:00Z' }),
  ]
  const ids = (f: Partial<typeof ALL_LECTURE_REVIEWS>) => filterLectureReviews(rows, { ...ALL_LECTURE_REVIEWS, ...f }).map((r) => r.id)

  it('everything, newest first', () => expect(ids({})).toEqual(['b', 'c', 'a', 'd']))
  it('one lecturer, also where they teach with someone else', () => expect(ids({ lecturer: 20 })).toEqual(['b', 'a', 'd']))
  it('another lecturer', () => expect(ids({ lecturer: 21 })).toEqual(['d']))
  it('lectures with no lecturer', () => expect(ids({ lecturer: 'none' })).toEqual(['c']))
  it('one week, or the lectures with no week', () => {
    expect(filterLectureReviews([review({ id: 'x' }), review({ id: 'y', lecture: { eventId: '9', title: 'Intro', startsAt: 's', endsAt: 'e' } })], { ...ALL_LECTURE_REVIEWS, moduleId: '3' }).map((r) => r.id)).toEqual(['x'])
    expect(filterLectureReviews([review({ id: 'x' }), review({ id: 'y', lecture: { eventId: '9', title: 'Intro', startsAt: 's', endsAt: 'e' } })], { ...ALL_LECTURE_REVIEWS, moduleId: 'none' }).map((r) => r.id)).toEqual(['y'])
  })
  it('one lecture', () => expect(ids({ lecture: lectureKey(rows[2]) })).toEqual(['c']))
  it('low scores are 2 or less', () => expect(ids({ show: 'low' })).toEqual(['b']))
  it('with a comment: either of the two texts', () => expect(ids({ show: 'comments' })).toEqual(['b', 'c']))
  it('searches the student, the lecture, the lecturers and the comments, ignoring case', () => {
    expect(ids({ query: 'bakh' })).toEqual(['b'])
    expect(ids({ query: 'CHANNELS' })).toEqual(['d'])
    expect(ids({ query: 'rashad' })).toEqual(['d'])
    expect(ids({ query: 'nice start' })).toEqual(['c'])
    expect(ids({ query: 'concurrency' })).toEqual(['b', 'c', 'a', 'd']) // the week's title
    expect(ids({ query: 'nobody' })).toEqual([])
  })
})

describe('summariseLectures', () => {
  it('counts, averages, the pace and the low scores', () => {
    const s = summariseLectures([
      review({ overall: 5, clarity: 5, pace: 'just_right' }),
      review({ overall: 1, clarity: 3, pace: 'too_fast', improve: 'Slower please' }),
      review({ overall: 3, clarity: 4, pace: 'too_fast', eventId: '50' }),
    ])
    expect(s.reviews).toBe(3)
    expect(s.lectures).toBe(2)
    expect(s.scores.overall).toBe(3)
    expect(s.scores.clarity).toBe(4)
    expect(s.pace).toEqual({ too_slow: 0, just_right: 1, too_fast: 2 })
    expect(s.justRight).toBeCloseTo(1 / 3)
    expect(s.low).toBe(1)
    expect(s.withComments).toBe(1)
  })

  it('nothing to average gives null', () => {
    const s = summariseLectures([])
    expect(s.scores.overall).toBeNull()
    expect(s.justRight).toBeNull()
    expect(s.pace).toEqual({ too_slow: 0, just_right: 0, too_fast: 0 })
  })
})

describe('byLecturer: the grouping', () => {
  const rows = [
    review({ lecturers: [{ id: 21, name: 'Rashad' }], overall: 5 }),
    review({ lecturers: [{ id: 20, name: 'Leyla' }], overall: 4 }),
    review({ lecturers: [{ id: 20, name: 'Leyla' }], overall: 2, eventId: '42' }),
    review({ lecturers: [{ id: 20, name: 'Leyla' }, { id: 21, name: 'Rashad' }], overall: 3, eventId: '43' }),
    review({ lecturers: [], overall: 1, eventId: '50', lectureTitle: 'Intro' }),
  ]

  it('one group per lecturer, A-Z, and the lectures with no lecturer last', () => {
    expect(byLecturer(rows).map((g) => [g.name, g.reviews, g.lectures])).toEqual([
      ['Leyla', 3, 3],
      ['Rashad', 2, 2],
      [NO_LECTURER, 1, 1],
    ])
  })

  it('a lecture taught by two lecturers counts for both', () => {
    const groups = byLecturer(rows)
    expect(groups.find((g) => g.name === 'Leyla')?.scores.overall).toBe(3) // 4, 2, 3
    expect(groups.find((g) => g.name === 'Rashad')?.scores.overall).toBe(4) // 5, 3
  })

  it('the group of lectures with no lecturer has no lecturer id', () => {
    expect(byLecturer(rows).at(-1)?.lecturerId).toBeNull()
  })
})

describe('lecturesOf', () => {
  it('each lecture once, newest first', () => {
    const intro = { eventId: '50', title: 'Intro', startsAt: '2026-11-09T11:00:00Z', endsAt: '2026-11-09T13:00:00Z' }
    const rows = [review({ eventId: '41' }), review({ eventId: '41' }), review({ lecture: intro })]
    expect(lecturesOf(rows).map((l) => l.title)).toEqual(['Goroutines', 'Intro'])
  })

  it('the same event id at another time is another lecture (the demo calendar repeats its ids)', () => {
    const later = { eventId: '41', title: 'Goroutines', startsAt: '2026-11-19T11:00:00Z', endsAt: '2026-11-19T13:00:00Z' }
    expect(lecturesOf([review({ eventId: '41' }), review({ lecture: later })])).toHaveLength(2)
  })
})
