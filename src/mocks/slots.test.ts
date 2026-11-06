import { describe, expect, it } from 'vitest'
import { slotLabel } from '../utils/slots'
import { addWindow, buildMockSlots, deleteSlot, listSlots, release, reserve } from './slots'
import type { Actor } from './slots'

const NOW = new Date(2026, 10, 4, 12, 0) // Wed 4 Nov 2026
const mentor: Actor = { id: 900, name: 'Rashad Aliyev', roles: ['mentor', 'lecturer'] }
const other: Actor = { id: 901, name: 'Another Mentor', roles: ['mentor'] }
const admin: Actor = { id: 1000, name: 'Admin', roles: ['admin'] }
const sam: Actor = { id: 1, name: 'Sam', roles: ['student'] }
const eli: Actor = { id: 2, name: 'Eli', roles: ['student'] }
const win = { date: '2026-11-06', start: '15:00', end: '18:00' }

describe('demo data', () => {
  const slots = buildMockSlots(NOW)
  it('opens two Thursdays: 15:00-18:00, then 15:00-17:00', () => {
    expect(slots).toHaveLength(6 + 4)
    expect(new Date(slots[0].startsAt).getDate()).toBe(5)
    expect(slotLabel(slots[0])).toBe('15:00 - 15:30')
    expect(new Date(slots[6].startsAt).getDate()).toBe(12)
  })
  it('has one time already taken by a teammate, and everything in the future', () => {
    expect(slots.filter((s) => s.booked)).toHaveLength(1)
    expect(slots.every((s) => new Date(s.startsAt) > NOW)).toBe(true)
  })
  it('a Thursday morning rolls over to the next Thursday', () => {
    const thu = new Date(2026, 10, 5, 9, 0)
    expect(new Date(buildMockSlots(thu)[0].startsAt).getDate()).toBe(12)
  })
})

describe('a mentor adds a window', () => {
  it('creates one slot per 30 minutes', () => {
    const slots = addWindow(mentor, win, NOW).filter((s) => s.startsAt.startsWith('2026-11-06') || new Date(s.startsAt).getDate() === 6)
    expect(slots.map(slotLabel)).toEqual([
      '15:00 - 15:30',
      '15:30 - 16:00',
      '16:00 - 16:30',
      '16:30 - 17:00',
      '17:00 - 17:30',
      '17:30 - 18:00',
    ])
    expect(slots.every((s) => !s.booked && s.mentorId === 900)).toBe(true)
  })

  it('skips times that clash with ones already there, so adding twice changes nothing', () => {
    const once = addWindow(mentor, win, NOW).length
    expect(addWindow(mentor, win, NOW)).toHaveLength(once)
    // a bigger window only adds what is new
    expect(addWindow(mentor, { ...win, start: '14:30' }, NOW)).toHaveLength(once + 1)
  })

  it('is refused for a student', () => {
    expect(() => addWindow(sam, win, NOW)).toThrow('Only mentors')
  })

  it('persists, and students see it', () => {
    addWindow(mentor, win, NOW)
    expect(listSlots(sam, NOW).filter((s) => new Date(s.startsAt).getDate() === 6)).toHaveLength(6)
  })
})

describe('a student books a time', () => {
  const first = () => listSlots(sam, NOW).find((s) => !s.booked)!

  it('locks it, and nobody else can take it', () => {
    const id = first().id
    const after = reserve(sam, id, NOW)
    expect(after.find((s) => s.id === id)).toMatchObject({ booked: true, bookedBy: { id: 1 } })
    expect(() => reserve(eli, id, NOW)).toThrow('someone just took this time')
  })

  it('allows one upcoming 1:1 at a time', () => {
    const [a, b] = listSlots(sam, NOW).filter((s) => !s.booked)
    reserve(sam, a.id, NOW)
    expect(() => reserve(sam, b.id, NOW)).toThrow('already have a 1:1 booked')
    release(sam, a.id, NOW)
    expect(() => reserve(sam, b.id, NOW)).not.toThrow()
  })

  it('does not let a student book a time that has started', () => {
    const slot = first()
    expect(() => reserve(sam, slot.id, new Date(slot.startsAt))).toThrow('already started')
  })

  it('refuses a mentor, and a time that is gone', () => {
    expect(() => reserve(mentor, first().id, NOW)).toThrow('Only students')
    expect(() => reserve(sam, 'nope', NOW)).toThrow('no longer exists')
  })

  it('never shows a student who booked someone else', () => {
    const id = first().id
    reserve(sam, id, NOW)
    const seenByEli = listSlots(eli, NOW).find((s) => s.id === id)!
    expect(seenByEli.booked).toBe(true)
    expect(seenByEli.bookedBy).toBeUndefined()
    expect(listSlots(sam, NOW).find((s) => s.id === id)!.bookedBy?.name).toBe('Sam')
    expect(listSlots(mentor, NOW).find((s) => s.id === id)!.bookedBy?.name).toBe('Sam')
    // the teammate's booking from the demo data is hidden from students too
    expect(listSlots(eli, NOW).find((s) => s.booked && s.bookedBy === undefined)).toBeDefined()
  })
})

describe('cancelling', () => {
  const book = () => {
    const id = listSlots(sam, NOW).find((s) => !s.booked)!.id
    reserve(sam, id, NOW)
    return id
  }

  it('a student can give their time back', () => {
    const id = book()
    expect(release(sam, id, NOW).find((s) => s.id === id)).toMatchObject({ booked: false, bookedBy: undefined })
    expect(() => reserve(eli, id, NOW)).not.toThrow() // free for the next student
  })

  it('a student cannot cancel someone else', () => {
    expect(() => release(eli, book(), NOW)).toThrow('cannot change this booking')
  })

  it('the mentor can cancel a booking', () => {
    const id = book()
    expect(release(mentor, id, NOW).find((s) => s.id === id)!.booked).toBe(false)
  })

  it('a free time cannot be cancelled, and a started 1:1 cannot be either', () => {
    const free = listSlots(sam, NOW).find((s) => !s.booked)!
    expect(() => release(sam, free.id, NOW)).toThrow('not booked')
    const id = book()
    const slot = listSlots(sam, NOW).find((s) => s.id === id)!
    expect(() => release(sam, id, new Date(slot.startsAt))).toThrow('already started')
  })
})

describe('removing a time', () => {
  it('removes a free one', () => {
    const slots = addWindow(mentor, win, NOW)
    const id = slots.find((s) => new Date(s.startsAt).getDate() === 6)!.id
    expect(deleteSlot(mentor, id, NOW).some((s) => s.id === id)).toBe(false)
  })

  it('refuses while a student holds it', () => {
    const id = listSlots(sam, NOW).find((s) => !s.booked)!.id
    reserve(sam, id, NOW)
    expect(() => deleteSlot(admin, id, NOW)).toThrow('Cancel the booking first')
  })

  it('refuses a student and a different teacher, but not an admin', () => {
    const id = listSlots(sam, NOW).find((s) => !s.booked)!.id
    expect(() => deleteSlot(sam, id, NOW)).toThrow('cannot change')
    expect(() => deleteSlot(other, id, NOW)).toThrow('cannot change')
    expect(() => deleteSlot(admin, id, NOW)).not.toThrow()
  })
})
