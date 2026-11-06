import type { AvailabilityWindow, MeetingSlot } from '../types/slots'
import type { User } from '../types/user'
import { canMentor, hasRole, isStudent } from '../utils/roles'
import { sortSlots, upcomingSlotTimes, withoutClashes } from '../utils/slots'
import { MENTOR } from './teams'

/**
 * Stand-in for the backend: a small slot store kept in localStorage, so a mentor and a student
 * who use the same browser see each other's changes. Every rule below is a rule the real backend
 * must enforce too (the client checks are only for nice error messages).
 */
export type Actor = Pick<User, 'id' | 'name' | 'roles'>

const KEY = 'mentor_slots'
const isAdmin = (a: Actor) => hasRole(a, 'admin')
/** A mentor manages their OWN times; an admin may fix anyone's. */
const manages = (a: Actor, s: MeetingSlot) => isAdmin(a) || (canMentor(a) && s.mentorId === a.id)

let seq = 0
const newId = () => `s-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** First open times for the demo: next Thursday 15:00-18:00 (one already taken) and the one after, 15:00-17:00. */
export function buildMockSlots(now: Date = new Date()): MeetingSlot[] {
  const toThursday = ((4 - now.getDay() + 7) % 7) || 7
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const windows: AvailabilityWindow[] = [
    { date: key(day(toThursday)), start: '15:00', end: '18:00' },
    { date: key(day(toThursday + 7)), start: '15:00', end: '17:00' },
  ]
  const slots = windows.flatMap((w, wi) =>
    upcomingSlotTimes(w, new Date(0)).map(
      (t, i): MeetingSlot => ({
        id: `seed-${wi}-${i}`,
        mentorId: MENTOR.id,
        mentorName: MENTOR.name,
        ...t,
        booked: false,
      }),
    ),
  )
  // a teammate already took the first time, so students can see what "taken" looks like
  slots[0] = { ...slots[0], booked: true, bookedBy: { id: 101, name: 'Leyla Hasanova' } }
  return slots
}

function load(now: Date): MeetingSlot[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MeetingSlot[]
  } catch {
    /* unreadable: fall back to the demo data */
  }
  const seed = buildMockSlots(now)
  save(seed) // keep the demo data stable (same ids and days) from now on
  return seed
}

function save(slots: MeetingSlot[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots))
  } catch {
    /* storage full or blocked: changes last until the page reloads */
  }
}

/**
 * What this person is allowed to see:
 * - a mentor: only their own times, with who booked them
 * - a student: their own mentor's times (every demo student is in Rashad's team); never who booked another's
 * - an admin: everything; anyone else (a lecturer who is no mentor): nothing
 */
function view(slots: MeetingSlot[], actor: Actor): MeetingSlot[] {
  let visible: MeetingSlot[]
  if (isAdmin(actor)) visible = slots
  else if (canMentor(actor)) visible = slots.filter((s) => s.mentorId === actor.id)
  else if (isStudent(actor))
    visible = slots
      .filter((s) => s.mentorId === MENTOR.id)
      .map((s) => (s.bookedBy?.id === actor.id ? s : { ...s, bookedBy: undefined }))
  else visible = []
  return sortSlots(visible)
}

export function listSlots(actor: Actor, now: Date = new Date()): MeetingSlot[] {
  return view(load(now), actor)
}

/** Mentor: opens a window; it is cut into 30-minute slots. Slots that clash with existing ones are skipped. */
export function addWindow(actor: Actor, window: AvailabilityWindow, now: Date = new Date()): MeetingSlot[] {
  if (!canMentor(actor)) throw new Error('Only mentors can add 1:1 times')
  const all = load(now)
  const mine = all.filter((s) => s.mentorId === actor.id)
  const fresh = withoutClashes(upcomingSlotTimes(window, now), mine).map(
    (t): MeetingSlot => ({ id: newId(), mentorId: actor.id, mentorName: actor.name, ...t, booked: false }),
  )
  const next = [...all, ...fresh]
  save(next)
  return view(next, actor)
}

export function deleteSlot(actor: Actor, id: string, now: Date = new Date()): MeetingSlot[] {
  const all = load(now)
  const slot = all.find((s) => s.id === id)
  if (!slot) throw new Error('This time no longer exists')
  if (!manages(actor, slot)) {
    throw new Error('You cannot change this time')
  }
  if (slot.booked) throw new Error('A student booked this time. Cancel the booking first.')
  const next = all.filter((s) => s.id !== id)
  save(next)
  return view(next, actor)
}

/** Student: locks a time. One upcoming booking at a time; two students can never get the same slot. */
export function reserve(actor: Actor, id: string, now: Date = new Date()): MeetingSlot[] {
  if (!isStudent(actor)) throw new Error('Only students can book a 1:1')
  const all = load(now)
  const slot = all.find((s) => s.id === id)
  // students can only book their own mentor's times
  if (!slot || slot.mentorId !== MENTOR.id) throw new Error('This time no longer exists')
  if (slot.booked) throw new Error('Sorry, someone just took this time. Please pick another one.')
  if (new Date(slot.startsAt) <= now) throw new Error('This time has already started')
  const has = all.some((s) => s.bookedBy?.id === actor.id && new Date(s.startsAt) > now)
  if (has) throw new Error('You already have a 1:1 booked. Cancel it first to pick another time.')
  const next = all.map((s) => (s.id === id ? { ...s, booked: true, bookedBy: { id: actor.id, name: actor.name } } : s))
  save(next)
  return view(next, actor)
}

/** Student: gives their time back. Mentor: cancels a student's booking. Either way the time is free again. */
export function release(actor: Actor, id: string, now: Date = new Date()): MeetingSlot[] {
  const all = load(now)
  const slot = all.find((s) => s.id === id)
  if (!slot || !slot.booked) throw new Error('This time is not booked')
  const mine = slot.bookedBy?.id === actor.id
  if (!mine && !manages(actor, slot)) throw new Error('You cannot change this booking')
  if (new Date(slot.startsAt) <= now) throw new Error('This 1:1 has already started')
  const next = all.map((s) => (s.id === id ? { ...s, booked: false, bookedBy: undefined } : s))
  save(next)
  return view(next, actor)
}
