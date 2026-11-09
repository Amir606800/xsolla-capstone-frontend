import { describe, expect, it } from 'vitest'
import { canHaveMeeting, isGoogleMeet, joinState, meetingUrlError } from './meeting'

const MEET = 'https://meet.google.com/abc-defg-hij'
const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m)
const lecture = { kind: 'lecture' as const, meetingUrl: MEET, startsAt: at(10).toISOString(), endsAt: at(12).toISOString() }

describe('meeting links', () => {
  it('accepts a Google Meet link, any other https link, and nothing at all (it is optional)', () => {
    for (const ok of [MEET, 'https://zoom.us/j/123456', '  https://meet.google.com/abc-defg-hij  ', '']) expect(meetingUrlError(ok), ok).toBe('')
  })

  it('refuses what is not a safe web address', () => {
    expect(meetingUrlError('meet.google.com/abc')).toBe('Enter a full link, like https://meet.google.com/abc-defg-hij.')
    expect(meetingUrlError('http://meet.google.com/abc-defg-hij')).toBe('The link must start with https://.')
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.com/a']) expect(meetingUrlError(bad), bad).toBe('The link must start with https://.')
    expect(meetingUrlError('https://localhost/room')).toBe('Enter a full link, like https://meet.google.com/abc-defg-hij.')
    expect(meetingUrlError('https://meet.google.com/a b')).toBe('A link has no spaces.')
    expect(meetingUrlError(`https://meet.google.com/${'a'.repeat(300)}`)).toBe('The link is too long.')
  })

  it('knows a Google Meet link', () => {
    expect(isGoogleMeet(MEET)).toBe(true)
    expect(isGoogleMeet('https://zoom.us/j/1')).toBe(false)
    expect(isGoogleMeet('https://evil.com/meet.google.com')).toBe(false)
    expect(isGoogleMeet('not a url')).toBe(false)
  })

  it('only lectures and meetings can have a meeting', () => {
    expect(canHaveMeeting('lecture')).toBe(true)
    expect(canHaveMeeting('meeting')).toBe(true)
    for (const k of ['off-campus', 'deadline', 'availability'] as const) expect(canHaveMeeting(k)).toBe(false)
  })

  it('students can join from 30 minutes before the start until the end', () => {
    expect(joinState(lecture, at(9, 29))).toMatchObject({ state: 'later' })
    expect(joinState(lecture, at(9, 30))).toEqual({ state: 'open' }) // exactly 30 minutes before
    expect(joinState(lecture, at(10, 0))).toEqual({ state: 'open' })
    expect(joinState(lecture, at(12, 0))).toEqual({ state: 'open' })
    expect(joinState(lecture, at(12, 1))).toEqual({ state: 'ended' })
  })

  it('says when the link will appear', () => {
    const s = joinState(lecture, at(8))
    expect(s.state === 'later' && s.opensAt.getTime()).toBe(at(9, 30).getTime())
  })

  it('no link, or an event that cannot have one, is nothing', () => {
    expect(joinState({ ...lecture, meetingUrl: undefined }, at(10))).toEqual({ state: 'none' })
    expect(joinState({ ...lecture, kind: 'off-campus' }, at(10))).toEqual({ state: 'none' })
  })
})
