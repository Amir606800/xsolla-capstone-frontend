import { describe, expect, it } from 'vitest'
import type { Discussion } from '../types/discussion'
import { discussionEvents, talkTimeError } from './discussions'

const now = new Date('2026-11-04T08:00:00Z')

describe('talkTimeError', () => {
  it('accepts a future talk of a normal length on any day', () => {
    expect(talkTimeError('2026-11-05', '15:00', '15:30', now)).toBeNull() // a Thursday
  })
  it('refuses a missing, backwards, too short, too long or past time', () => {
    expect(talkTimeError('2026-11-05', '', '15:30', now)).toMatch(/start and an end/)
    expect(talkTimeError('2026-11-05', '16:00', '15:30', now)).toMatch(/after the start/)
    expect(talkTimeError('2026-11-05', '15:00', '15:05', now)).toMatch(/at least 10/)
    expect(talkTimeError('2026-11-05', '10:00', '15:00', now)).toMatch(/at most 4 hours/)
    expect(talkTimeError('2026-11-03', '15:00', '15:30', now)).toMatch(/already passed/)
  })
})

const row = (id: string, studentId: number, studentName: string): Discussion => ({
  id,
  batchId: 'b1',
  mentorId: 900,
  mentorName: 'Rashad',
  studentId,
  studentName,
  title: 'Plan',
  startsAt: '2026-11-05T11:00:00Z',
  endsAt: '2026-11-05T11:30:00Z',
})

describe('discussionEvents', () => {
  const rows = [row('1', 1, 'Sam'), row('2', 2, 'Leyla')]
  it('shows a mentor one entry per talk, with every student invited', () => {
    const [e, ...rest] = discussionEvents(rows, { isMentor: true })
    expect(rest).toEqual([])
    expect(e).toMatchObject({
      id: 'talk-1',
      kind: 'discussion',
      title: 'Plan',
    })
    expect(e.attendees?.map((a) => a.name)).toEqual(['Sam', 'Leyla'])
  })
  it('shows a student the mentor', () => {
    const [e] = discussionEvents([rows[0]], { isMentor: false })
    expect(e.description).toBe('A talk with Rashad.')
    expect(e.attendees?.map((a) => a.name)).toEqual(['Rashad'])
  })
})
