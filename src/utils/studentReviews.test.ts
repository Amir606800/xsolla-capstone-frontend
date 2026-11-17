import { describe, expect, it } from 'vitest'
import type { StudentReview } from '../types/studentReview'
import { ALL_STUDENT_REVIEWS, filterStudentReviews, mentorsOf } from './studentReviews'
import type { StudentReviewFilter } from './studentReviews'

const rows: StudentReview[] = [
  { id: 'a', moduleId: 'm4', week: 4, studentId: 1, studentName: 'Sam Student', mentorId: 900, mentorName: 'Rashad Aliyev', teamName: 'Team 1', level: 'yellow', note: 'Behind on the tasks', gradedAt: '2026-11-01T10:00:00Z' },
  { id: 'b', moduleId: 'm5', week: 5, studentId: 1, studentName: 'Sam Student', mentorId: 900, mentorName: 'Rashad Aliyev', teamName: 'Team 1', level: 'green', gradedAt: '2026-11-08T10:00:00Z' },
  { id: 'c', moduleId: 'm5', week: 5, studentId: 2, studentName: 'Leyla Hasanova', mentorId: 901, mentorName: 'Aysel Mammadova', teamName: 'Team 2', level: 'red', note: 'No progress report', gradedAt: '2026-11-08T11:00:00Z' },
]

const ids = (f: Partial<StudentReviewFilter>) => filterStudentReviews(rows, { ...ALL_STUDENT_REVIEWS, ...f }).map((r) => r.id)

describe('filterStudentReviews', () => {
  it('everything, newest first', () => expect(ids({})).toEqual(['c', 'b', 'a']))
  it('one week', () => expect(ids({ moduleId: 'm4' })).toEqual(['a']))
  it('one mentor', () => expect(ids({ mentorId: 901 })).toEqual(['c']))
  it('one grade', () => {
    expect(ids({ show: 'red' })).toEqual(['c'])
    expect(ids({ show: 'green' })).toEqual(['b'])
  })
  it('only the ones with module feedback', () => expect(ids({ show: 'comments' })).toEqual(['c', 'a']))
  it('searches the student, the mentor, the team and the feedback, ignoring case', () => {
    expect(ids({ query: 'leyla' })).toEqual(['c'])
    expect(ids({ query: 'RASHAD' })).toEqual(['b', 'a'])
    expect(ids({ query: 'team 2' })).toEqual(['c'])
    expect(ids({ query: 'behind' })).toEqual(['a'])
  })
  it('does not change the list it is given', () => {
    const before = rows.map((r) => r.id)
    ids({})
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})

describe('mentorsOf', () => {
  it('each mentor that has graded once, A-Z', () => {
    expect(mentorsOf(rows)).toEqual([
      { id: 901, name: 'Aysel Mammadova' },
      { id: 900, name: 'Rashad Aliyev' },
    ])
  })
  it('leaves out grades with no known mentor', () => {
    expect(mentorsOf([{ ...rows[0], mentorId: undefined, mentorName: undefined }])).toEqual([])
  })
})
