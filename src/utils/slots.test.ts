import { describe, expect, it } from 'vitest'
import type { MeetingSlot } from '../types/slots'
import {
  myNextBooking,
  overlaps,
  previewText,
  slotEvents,
  slotLabel,
  slotsOnDay,
  splitWindow,
  toMinutes,
  upcomingSlotTimes,
  windowError,
  withoutClashes,
} from './slots'

const NOW = new Date(2026, 10, 4, 12, 0) // Wed 4 Nov 2026, 12:00
const day = '2026-11-05'
const labels = (w: { date: string; start: string; end: string }) => splitWindow(w).map(slotLabel)

describe('toMinutes', () => {
  it('reads HH:MM', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('15:30')).toBe(930)
    expect(toMinutes('23:59')).toBe(1439)
  })
  it.each(['', '9:00', '24:00', '15:60', 'abc', '15-00'])('rejects "%s"', (t) => {
    expect(toMinutes(t)).toBeNull()
  })
})

describe('splitWindow: cuts a window into 30-minute slots', () => {
  it('15:00-18:00 gives six slots, 15:00-15:30 ... 17:30-18:00', () => {
    expect(labels({ date: day, start: '15:00', end: '18:00' })).toEqual([
      '15:00 - 15:30',
      '15:30 - 16:00',
      '16:00 - 16:30',
      '16:30 - 17:00',
      '17:00 - 17:30',
      '17:30 - 18:00',
    ])
  })

  it('every slot is exactly 30 minutes and they touch without gaps', () => {
    const slots = splitWindow({ date: day, start: '09:00', end: '12:00' })
    for (const s of slots) expect(new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()).toBe(30 * 60_000)
    slots.slice(1).forEach((s, i) => expect(s.startsAt).toBe(slots[i].endsAt))
  })

  it('one slot for exactly 30 minutes', () => {
    expect(labels({ date: day, start: '15:00', end: '15:30' })).toEqual(['15:00 - 15:30'])
  })

  it('works on half hours', () => {
    expect(labels({ date: day, start: '15:15', end: '15:50' })).toEqual(['15:15 - 15:45'])
    expect(labels({ date: day, start: '10:30', end: '11:30' })).toEqual(['10:30 - 11:00', '11:00 - 11:30'])
  })

  it('drops a leftover shorter than a full slot', () => {
    expect(labels({ date: day, start: '15:00', end: '16:20' })).toEqual(['15:00 - 15:30', '15:30 - 16:00'])
  })

  it('gives nothing for a window that is too short, reversed, empty or malformed', () => {
    expect(splitWindow({ date: day, start: '15:00', end: '15:20' })).toEqual([])
    expect(splitWindow({ date: day, start: '18:00', end: '15:00' })).toEqual([])
    expect(splitWindow({ date: day, start: '15:00', end: '15:00' })).toEqual([])
    expect(splitWindow({ date: day, start: '', end: '15:00' })).toEqual([])
    expect(splitWindow({ date: 'x', start: '15:00', end: '16:00' })).toEqual([])
  })

  it('lands on the chosen local day', () => {
    const [first] = splitWindow({ date: day, start: '15:00', end: '16:00' })
    const d = new Date(first.startsAt)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 5, 15, 0])
  })
})

describe('upcomingSlotTimes / windowError', () => {
  it('skips the slots that already started', () => {
    // it is 12:00 on the 4th; a window earlier today keeps only what is still ahead
    const w = { date: '2026-11-04', start: '11:00', end: '13:00' }
    expect(upcomingSlotTimes(w, NOW).map(slotLabel)).toEqual(['12:30 - 13:00'])
  })

  it('accepts a good window', () => {
    expect(windowError({ date: day, start: '15:00', end: '18:00' }, NOW)).toBeNull()
  })

  it.each([
    [{ date: day, start: '', end: '18:00' }, 'Pick a start and an end time.'],
    [{ date: day, start: '18:00', end: '15:00' }, 'The end time must be after the start time.'],
    [{ date: day, start: '15:00', end: '15:15' }, 'The window must be at least 30 minutes long.'],
    [{ date: '2026-11-03', start: '15:00', end: '18:00' }, 'That time has already passed. Pick a time in the future.'],
  ])('explains what is wrong with %j', (w, msg) => {
    expect(windowError(w, NOW)).toBe(msg)
  })
})

describe('clashes', () => {
  const t = (a: string, b: string) => ({ startsAt: `2026-11-05T${a}:00.000Z`, endsAt: `2026-11-05T${b}:00.000Z` })

  it('touching ends do not overlap', () => {
    expect(overlaps(t('15:00', '15:30'), t('15:30', '16:00'))).toBe(false)
    expect(overlaps(t('15:00', '15:30'), t('15:29', '16:00'))).toBe(true)
  })

  it('skips candidates that clash with existing slots', () => {
    const out = withoutClashes([t('15:00', '15:30'), t('15:30', '16:00')], [t('15:00', '15:30')])
    expect(out).toEqual([t('15:30', '16:00')])
  })

  it('skips candidates that clash with each other', () => {
    expect(withoutClashes([t('15:00', '15:30'), t('15:15', '15:45')], [])).toHaveLength(1)
  })
})

describe('previewText', () => {
  const times = splitWindow({ date: day, start: '15:00', end: '18:00' })
  it('summarises a long list', () => {
    expect(previewText(times)).toBe('6 times: 15:00 - 15:30 ... 17:30 - 18:00')
  })
  it('lists a short one in full', () => {
    expect(previewText(times.slice(0, 2))).toBe('2 times: 15:00 - 15:30, 15:30 - 16:00')
    expect(previewText(times.slice(0, 1))).toBe('1 time: 15:00 - 15:30')
  })
  it('is empty for nothing', () => {
    expect(previewText([])).toBe('')
  })
})

describe('slots on the calendar', () => {
  const slot = (h: number, m: number, extra: Partial<MeetingSlot> = {}): MeetingSlot => {
    const start = new Date(2026, 10, 5, h, m)
    return {
      id: `s${h}${m}`,
      mentorId: 900,
      mentorName: 'Rashad',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
      booked: false,
      ...extra,
    }
  }
  const slots = [
    slot(15, 0, { booked: true, bookedBy: { id: 1, name: 'Sam' } }),
    slot(15, 30, { booked: true }), // someone else: a student does not see who
    slot(16, 0),
    slot(16, 30),
  ]

  it('myNextBooking finds the student own upcoming booking only', () => {
    expect(myNextBooking(slots, 1, NOW)?.id).toBe('s150')
    expect(myNextBooking(slots, 2, NOW)).toBeUndefined()
    expect(myNextBooking(slots, 1, new Date(2026, 10, 5, 15, 5))).toBeUndefined() // already started
  })

  it('slotsOnDay returns the day in time order', () => {
    expect(slotsOnDay([slots[3], slots[0]], '2026-11-05').map((s) => s.id)).toEqual(['s150', 's1630'])
    expect(slotsOnDay(slots, '2026-11-06')).toEqual([])
  })

  it('a student gets their booking as a meeting and one summary of the free times', () => {
    const events = slotEvents(slots, { id: 1, isMentor: false }, NOW)
    const meeting = events.find((e) => e.kind === 'meeting')!
    expect(meeting.title).toBe('1:1 with Rashad')
    const free = events.find((e) => e.kind === 'availability')!
    expect(free.title).toBe('2 free 1:1 times')
    expect(events).toHaveLength(2) // the time another student took is not shown at all
  })

  it('does not offer times that already started', () => {
    const late = new Date(2026, 10, 5, 16, 10)
    const events = slotEvents(slots, { id: 2, isMentor: false }, late)
    expect(events.find((e) => e.kind === 'availability')?.title).toBe('1 free 1:1 time')
  })

  it('a mentor gets a summary of the day and every booked slot as a meeting', () => {
    const events = slotEvents(slots, { id: 900, isMentor: true }, NOW)
    expect(events.find((e) => e.kind === 'availability')?.title).toBe('1:1 times: 2 of 4 free')
    expect(events.filter((e) => e.kind === 'meeting').map((e) => e.title)).toEqual(['1:1 with Sam'])
  })

  it('the meeting cards carry the Meet link and the people on the 1:1; the free-times summary does not', () => {
    const people = [
      { id: 900, name: 'Rashad', email: 'r@x.az' },
      { id: 1, name: 'Sam', email: 's@x.az' },
    ]
    const withMeet = slots.map((s) => (s.bookedBy?.id === 1 ? { ...s, meetingUrl: 'https://meet.google.com/abc-defg-hij', attendees: people } : s))
    for (const viewer of [{ id: 1, isMentor: false }, { id: 900, isMentor: true }]) {
      const events = slotEvents(withMeet, viewer, NOW)
      expect(events.find((e) => e.kind === 'meeting')).toMatchObject({ meetingUrl: 'https://meet.google.com/abc-defg-hij', attendees: people })
      expect(events.find((e) => e.kind === 'availability')).not.toHaveProperty('attendees')
    }
  })

  it('no slots, no events', () => {
    expect(slotEvents([], { id: 1, isMentor: false }, NOW)).toEqual([])
  })
})
