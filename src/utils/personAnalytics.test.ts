import { describe, expect, it } from 'vitest'
import type { AdminLectureReview } from '../types/lectureReview'
import type { StandingLevel } from '../types/standing'
import type { StudentReview } from '../types/studentReview'
import {
  currentCounts,
  inPeriod,
  lectureRows,
  needsAttention,
  quizShare,
  ratingSplit,
  ratingVerdict,
  responseRate,
  schoolVerdict,
  standingsByStudent,
  studentVerdict,
} from './personAnalytics'
import { analyseStandings } from './standing'

const weeks = (...levels: StandingLevel[]) =>
  analyseStandings(levels.map((level, i) => ({ week: i + 1, level, assessedAt: '2026-10-01T10:00:00Z' })))

function grades(studentId: number, name: string, ...levels: StandingLevel[]): StudentReview[] {
  return levels.map((level, i) => ({
    id: `${studentId}:${i + 1}`,
    moduleId: `m${i + 1}`,
    week: i + 1,
    studentId,
    studentName: name,
    level,
    gradedAt: `2026-10-0${i + 1}T10:00:00Z`,
  }))
}

describe('studentVerdict: the program rules in one line', () => {
  it('not graded, on track, falling behind, at risk, removal', () => {
    expect(studentVerdict(weeks()).title).toBe('Not graded yet')
    expect(studentVerdict(weeks('yellow', 'green'))).toMatchObject({ tone: 'good', title: 'On track' })
    expect(studentVerdict(weeks('green', 'yellow', 'yellow'))).toMatchObject({ tone: 'warn', title: 'Falling behind' })
    expect(studentVerdict(weeks('green', 'yellow', 'yellow')).text).toContain('2 yellow weeks in a row')
    expect(studentVerdict(weeks('green', 'red'))).toMatchObject({ tone: 'bad', title: 'At risk' })
    expect(studentVerdict(weeks('red', 'red'))).toMatchObject({ tone: 'bad', title: 'Removal' })
  })

  it('the 4th yellow week in a row counts as red, and says why', () => {
    const v = studentVerdict(weeks('yellow', 'yellow', 'yellow', 'yellow'))
    expect(v.title).toBe('At risk')
    expect(v.text).toContain('4th yellow week in a row')
  })
})

describe('needsAttention', () => {
  it('worst first, then A-Z; one yellow week alone is not flagged', () => {
    const rows = [
      ...grades(1, 'Zara', 'green', 'yellow', 'yellow'),
      ...grades(2, 'Ali', 'green', 'yellow'),
      ...grades(3, 'Bob', 'red', 'red'),
      ...grades(4, 'Cem', 'green', 'red'),
      ...grades(5, 'Dan', 'green', 'yellow', 'yellow'),
    ]
    expect(needsAttention(rows).map((s) => [s.name, s.severity])).toEqual([
      ['Bob', 3],
      ['Cem', 2],
      ['Dan', 1],
      ['Zara', 1],
    ])
  })

  it('counts a group by the average of their week grades; nobody graded yet is "none"', () => {
    const standings = standingsByStudent([
      ...grades(1, 'A', 'green'),
      ...grades(2, 'B', 'green', 'yellow', 'yellow'), // (3+2+2)/3 = 2.3: yellow, although the first week was green
    ])
    expect(currentCounts([1, 2, 3], standings)).toEqual({ green: 1, yellow: 1, red: 0, none: 1 })
  })
})

describe('ratings', () => {
  it('splits 1-5 scores into 4-5, 3 and 1-2', () => {
    expect(ratingSplit([5, 4, 3, 2, 1, 4])).toEqual({ positive: 3, neutral: 1, negative: 2 })
  })

  it('names the band only with enough ratings', () => {
    expect(ratingVerdict(null, 0, 'this mentor').title).toBe('No ratings yet')
    expect(ratingVerdict(5, 2, 'this mentor').title).toBe('Too few ratings')
    expect(ratingVerdict(4.2, 10, 'this mentor')).toMatchObject({
      tone: 'good',
      title: 'Well rated',
      text: 'Students rate this mentor 4.2 out of 5 from 10 ratings.',
    })
    expect(ratingVerdict(3.4, 10, 'x').tone).toBe('warn')
    expect(ratingVerdict(2.1, 10, 'x').tone).toBe('bad')
  })
})

describe('the school in one line', () => {
  it('by the share of students on track now', () => {
    expect(schoolVerdict({ green: 0, yellow: 0, red: 0, none: 5 }, 0).title).toBe('No grades yet')
    expect(schoolVerdict({ green: 8, yellow: 1, red: 1, none: 0 }, 1)).toMatchObject({
      tone: 'good',
      text: '8 of 10 graded students on track now. 1 student needs attention.',
    })
    // nobody graded yet is not "behind"
    expect(schoolVerdict({ green: 5, yellow: 4, red: 1, none: 20 }, 3)).toMatchObject({
      tone: 'warn',
      text: '5 of 10 graded students on track now. 20 not graded yet. 3 students need attention.',
    })
    expect(schoolVerdict({ green: 2, yellow: 4, red: 4, none: 0 }, 6).tone).toBe('bad')
  })
})

describe('period and shares', () => {
  it('a period is in school days (Baku), both ends included, either end open', () => {
    // 21:30 UTC on 1 Oct is already 2 Oct in Baku
    expect(inPeriod('2026-10-01T21:30:00Z', '2026-10-02', '2026-10-02')).toBe(true)
    expect(inPeriod('2026-10-01T10:00:00Z', '2026-10-02', '')).toBe(false)
    expect(inPeriod('2026-10-01T10:00:00Z', '', '')).toBe(true)
  })

  it('quiz accuracy weighs points, not percentages; no points = no figure', () => {
    expect(
      quizShare([
        { scoreTotal: 9, possibleTotal: 10 },
        { scoreTotal: 1, possibleTotal: 10 },
      ]),
    ).toBe(0.5)
    expect(quizShare([{ scoreTotal: 0, possibleTotal: 0 }])).toBeNull()
  })
})

describe('lectures', () => {
  const review = (
    eventId: string,
    startsAt: string,
    overall: 1 | 2 | 3 | 4 | 5,
    pace: AdminLectureReview['pace'],
  ): AdminLectureReview => ({
    id: `${eventId}-${overall}-${pace}`,
    lecture: { eventId, title: `Lecture ${eventId}`, startsAt, endsAt: startsAt },
    lecturers: [{ id: 902, name: 'Elvin' }],
    studentId: 1,
    studentName: 'Sam',
    overall,
    clarity: overall,
    practice: overall,
    confidence: overall,
    pace,
    submittedAt: startsAt,
  })

  it('one row per lecture, newest first, with the answers out of the students who could answer', () => {
    const rows = lectureRows(
      [
        review('1', '2026-10-01T10:00:00Z', 4, 'just_right'),
        review('1', '2026-10-01T10:00:00Z', 2, 'too_fast'),
        review('2', '2026-10-08T10:00:00Z', 5, 'just_right'),
      ],
      { '1@2026-10-01T10:00:00Z': 4 },
    )
    expect(rows.map((r) => [r.title, r.responses, r.expected, r.overall])).toEqual([
      ['Lecture 2', 1, null, 5],
      ['Lecture 1', 2, 4, 3],
    ])
    // only lectures whose expected count is known count for the rate
    expect(responseRate(rows)).toBe(0.5)
    expect(responseRate(lectureRows([review('2', '2026-10-08T10:00:00Z', 5, 'just_right')]))).toBeNull()
  })
})
