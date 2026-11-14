import { describe, expect, it } from 'vitest'
import type { PendingLecture } from '../types/lectureFeedback'
import { cleanAnswers, isFeedbackOpen, LECTURE_FORM, lecturesOfModule, validateAnswers } from './lectureFeedback'

const lecture = (over: Partial<PendingLecture> = {}): PendingLecture => ({
  eventId: '1',
  title: 'Goroutines',
  startsAt: '2026-11-09T10:00:00.000Z',
  endsAt: '2026-11-09T12:00:00.000Z',
  closesAt: '2026-11-16T12:00:00.000Z',
  ...over,
})

describe('isFeedbackOpen: from 10 minutes before the lecture ends until 7 days after', () => {
  const l = { endsAt: '2026-11-09T12:00:00.000Z' }
  const at = (iso: string) => isFeedbackOpen(l, new Date(iso))
  it('is not open while the lecture is still running', () => expect(at('2026-11-09T11:49:59.000Z')).toBe(false))
  it('opens 10 minutes before the end, so it can be filled in class', () => expect(at('2026-11-09T11:50:00.000Z')).toBe(true))
  it('stays open after the lecture', () => expect(at('2026-11-12T08:00:00.000Z')).toBe(true))
  it('is open until the last moment of the 7th day', () => expect(at('2026-11-16T11:59:59.000Z')).toBe(true))
  it('is closed from 7 days after the end', () => expect(at('2026-11-16T12:00:00.000Z')).toBe(false))
})

describe('lecturesOfModule', () => {
  const week = { id: '5', opensAt: '2026-11-09T00:00:00.000Z', closesAt: '2026-11-15T23:59:00.000Z' }

  it('keeps the lectures of that week, newest first', () => {
    const rows = [
      lecture({ eventId: 'a', moduleId: '5' }),
      lecture({ eventId: 'b', moduleId: '4' }),
      lecture({ eventId: 'c', moduleId: '5', startsAt: '2026-11-12T10:00:00.000Z' }),
    ]
    expect(lecturesOfModule(rows, week).map((l) => l.eventId)).toEqual(['c', 'a'])
  })

  it('a lecture with no week goes with the week it happens in', () => {
    const inside = lecture({ eventId: 'in', startsAt: '2026-11-10T10:00:00.000Z' })
    const outside = lecture({ eventId: 'out', startsAt: '2026-11-02T10:00:00.000Z' })
    expect(lecturesOfModule([inside, outside], week).map((l) => l.eventId)).toEqual(['in'])
  })

  it('a week without dates takes no lecture that has no week', () => {
    expect(lecturesOfModule([lecture()], { id: '5' })).toEqual([])
  })
})

describe('validateAnswers', () => {
  const full = { overall: 4, clarity: 5, practice: 3, pace: 'too_fast', confidence: 2 }

  it('a form with every required answer is fine; the text is optional', () => {
    expect(validateAnswers(LECTURE_FORM, full)).toEqual({})
  })

  it('names every required question that is missing', () => {
    expect(Object.keys(validateAnswers(LECTURE_FORM, {})).sort()).toEqual([
      'clarity',
      'confidence',
      'overall',
      'pace',
      'practice',
    ])
    expect(validateAnswers(LECTURE_FORM, { ...full, pace: undefined }).pace).toBe('Choose one.')
    expect(validateAnswers(LECTURE_FORM, { ...full, overall: undefined }).overall).toBe('Choose a rating.')
  })

  it('a text over its limit is a problem, trimmed text is not', () => {
    expect(validateAnswers(LECTURE_FORM, { ...full, liked: 'x'.repeat(1001) }).liked).toMatch(/1000/)
    expect(validateAnswers(LECTURE_FORM, { ...full, liked: `  ${'x'.repeat(1000)}  ` })).toEqual({})
  })
})

describe('cleanAnswers', () => {
  it('trims the text and leaves out empty text and unknown fields', () => {
    expect(cleanAnswers(LECTURE_FORM, { overall: 4, liked: '  The live coding ', improve: '   ', other: 'x' })).toEqual({
      overall: 4,
      liked: 'The live coding',
    })
  })
})
