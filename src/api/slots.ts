import { addWindow, deleteSlot, listSlots, release, reserve } from '../mocks/slots'
import type { AvailabilityWindow, MeetingSlot } from '../types/slots'
import { authedRequest } from './authed'
import { hasBackend } from './http'

/**
 * Real 1:1 slot calls to the backend (internal/handlers/mentor_slot.go).
 *   GET    /mentor-slots                    all callers: their visible slots
 *   POST   /mentor-slots {date,start,end}   mentor: cuts a window into 30-minute slots
 *   DELETE /mentor-slots/:id                mentor: removes a FREE slot
 *   POST   /mentor-slots/:id/book           student: locks the slot (409 when taken or already booked)
 *   DELETE /mentor-slots/:id/book           student/mentor: cancels a booking
 * Every call returns the caller's updated slot list. The backend hides other students' booking identities.
 * Without VITE_API_URL the same calls run on the demo store (mocks/slots), so the app also works offline.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

// Who is asking. The server reads the caller from the token; the demo store needs it for roles.
type Actor = import('../mocks/slots').Actor

interface MentorSlotResponse {
  id: string
  mentor_id: number
  mentor_name: string
  starts_at: string // ISO
  ends_at: string // ISO
  booked: boolean
  booked_by?: number
  booked_by_name?: string
}

function toMeetingSlot(s: MentorSlotResponse): MeetingSlot {
  return {
    id: s.id,
    mentorId: s.mentor_id,
    mentorName: s.mentor_name,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    booked: s.booked,
    ...(s.booked_by !== undefined ? { bookedBy: { id: s.booked_by, name: s.booked_by_name ?? '' } } : {}),
  }
}

export async function fetchSlots(actor: Actor): Promise<MeetingSlot[]> {
  if (!hasBackend()) {
    await wait()
    return listSlots(actor)
  }
  const rows = await authedRequest<MentorSlotResponse[] | null>('/mentor-slots')
  return (rows ?? []).map(toMeetingSlot)
}

export async function createAvailability(actor: Actor, window: AvailabilityWindow): Promise<MeetingSlot[]> {
  if (!hasBackend()) {
    await wait()
    return addWindow(actor, window)
  }
  const rows = await authedRequest<MentorSlotResponse[] | null>('/mentor-slots', {
    method: 'POST',
    body: { date: window.date, start: window.start, end: window.end },
  })
  return (rows ?? []).map(toMeetingSlot)
}

export async function removeSlot(actor: Actor, id: string): Promise<MeetingSlot[]> {
  if (!hasBackend()) {
    await wait()
    return deleteSlot(actor, id)
  }
  const rows = await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}`, {
    method: 'DELETE',
  })
  return (rows ?? []).map(toMeetingSlot)
}

export async function bookSlot(actor: Actor, id: string): Promise<MeetingSlot[]> {
  if (!hasBackend()) {
    await wait()
    return reserve(actor, id)
  }
  const rows = await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}/book`, {
    method: 'POST',
  })
  return (rows ?? []).map(toMeetingSlot)
}

export async function cancelBooking(actor: Actor, id: string): Promise<MeetingSlot[]> {
  if (!hasBackend()) {
    await wait()
    return release(actor, id)
  }
  const rows = await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}/book`, {
    method: 'DELETE',
  })
  return (rows ?? []).map(toMeetingSlot)
}
