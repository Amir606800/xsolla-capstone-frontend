import { authedRequest } from './authed'
import type { AvailabilityWindow, MeetingSlot } from '../types/slots'

/**
 * Real 1:1 slot calls to the backend (internal/handlers/mentor_slot.go).
 *   GET    /mentor-slots                    all callers: their visible slots
 *   POST   /mentor-slots {date,start,end}   mentor: cuts a window into 30-minute slots
 *   DELETE /mentor-slots/:id                mentor: removes a FREE slot
 *   POST   /mentor-slots/:id/book           student: locks the slot (409 when taken or already booked)
 *   DELETE /mentor-slots/:id/book           student/mentor: cancels a booking
 * Every call returns the caller's updated slot list. The backend hides other students' booking identities.
 */

// Who is asking. Unused here: the server reads the caller from the token. It stays in the
// signature because useMeetingSlots and the test mock both pass it (the mock needs it for roles).
type Actor = { id: number; name: string; roles: string[] }

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

export async function fetchSlots(_actor: Actor): Promise<MeetingSlot[]> {
  const rows = await authedRequest<MentorSlotResponse[] | null>('/mentor-slots')
  return (rows ?? []).map(toMeetingSlot)
}

export async function createAvailability(_actor: Actor, window: AvailabilityWindow): Promise<MeetingSlot[]> {
  const rows = await authedRequest<MentorSlotResponse[] | null>('/mentor-slots', {
    method: 'POST',
    body: { date: window.date, start: window.start, end: window.end },
  })
  return (rows ?? []).map(toMeetingSlot)
}

export async function removeSlot(_actor: Actor, id: string): Promise<MeetingSlot[]> {
  const rows = await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}`, {
    method: 'DELETE',
  })
  return (rows ?? []).map(toMeetingSlot)
}

export async function bookSlot(_actor: Actor, id: string): Promise<MeetingSlot[]> {
  const rows = await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}/book`, {
    method: 'POST',
  })
  return (rows ?? []).map(toMeetingSlot)
}

export async function cancelBooking(_actor: Actor, id: string): Promise<MeetingSlot[]> {
  const rows = await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}/book`, {
    method: 'DELETE',
  })
  return (rows ?? []).map(toMeetingSlot)
}
